#!/usr/bin/env python3
"""
Refactor Analysis Tool
Analyzes original ad source (2_Assets) vs dev-refactored versions (4_Routing/R[highest]/HTML)
for IADS-7000+ jobs. Generates REFACTOR_ANALYSIS.md report.
"""

import os
import re
import sys
import glob
import html.parser
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

BASE_DIR = Path("/Users/Philip.Kowalski/Library/CloudStorage/Egnyte-patientpoint/Shared/creative/root/02_Ads/Digital/IXR_Interact")
MIN_IADS = 7000
DRY_RUN_LIMIT = None  # Set to int for dry run, None for full run

# --- HTML Parsing Helpers ---

def read_file_safe(path):
    """Read file with multiple encoding fallbacks."""
    for enc in ('utf-8', 'latin-1', 'cp1252'):
        try:
            with open(path, 'r', encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, OSError):
            continue
    return None


def extract_meta_ad_size(html_content):
    """Extract ad dimensions from meta tag."""
    m = re.search(r'<meta\s+name=["\']ad\.size["\']\s+content=["\']width=(\d+),\s*height=(\d+)["\']', html_content, re.I)
    if m:
        return int(m.group(1)), int(m.group(2))
    # Try viewport
    m = re.search(r'<meta\s+name=["\']viewport["\']\s+content=["\'].*?width=(\d+).*?["\']', html_content, re.I)
    if m:
        w = int(m.group(1))
        # Try to find height from body/container style
        hm = re.search(r'height\s*:\s*(\d+)px', html_content)
        h = int(hm.group(1)) if hm else None
        return w, h
    return None, None


def detect_brand_type(width, height, folder_name):
    """Detect CP/MR/INT/MOD from dimensions or folder name suffix."""
    suffix = folder_name.rstrip('/').split('_')[-1].lower()
    suffix_map = {'cp': 'CP', 'mr': 'MR', 'mrp': 'MRP', 'mra': 'MRA', 'int': 'INT', 'mod': 'MOD', 'pa': 'PA'}
    if suffix in suffix_map:
        return suffix_map[suffix]
    if width and height:
        if width == 1080 and height == 1733:
            return 'CP'
        elif width == 300 and height == 250:
            return 'MR'
    return 'OTHER'


def is_gwd(html_content):
    """Check if ad is Google Web Designer output."""
    indicators = ['<gwd-', 'data-gwd-', 'Enabler.js', 'gwd-page', 'gwd_preview', 'google-web-designer']
    return any(ind in html_content for ind in indicators)


def detect_language(html_content):
    """Detect English or Spanish."""
    spanish_words = ['hable', 'médico', 'español', 'hablar', 'pregúntele', 'información', 'paciente',
                     'medicamento', 'tratamiento', 'efectos secundarios', 'riesgo', 'embarazo']
    content_lower = html_content.lower()
    spanish_count = sum(1 for w in spanish_words if w in content_lower)
    lang_match = re.search(r'lang=["\'](\w+)', html_content)
    if lang_match:
        lang = lang_match.group(1).lower()
        if lang.startswith('es'):
            return 'Spanish'
        if lang.startswith('en'):
            return 'English'
    return 'Spanish' if spanish_count >= 2 else 'English'


def has_isi(html_content):
    """Check if ad has ISI (Important Safety Information)."""
    # Structural checks — ISI as an ID, class, or filename (most reliable)
    if re.search(r'(?:id|class)=["\'][^"\']*\bisi\b[^"\']*["\']', html_content, re.I):
        return True
    if re.search(r'outerMostDiv|innerMostDiv|isi-controls|isi-copy|isi-con', html_content, re.I):
        return True
    # ISI image asset referenced
    if re.search(r'["\'/]isi[_\-].*?\.(png|jpg|gif)', html_content, re.I):
        return True
    # Explicit ISI text headers
    if re.search(r'important\s+safety\s+information', html_content, re.I):
        return True
    return False


def has_animation(html_content):
    """Check for animation presence."""
    anim_patterns = ['@keyframes', 'animation:', 'TweenMax', 'TweenLite', 'gsap', 'TimelineMax',
                     'TimelineLite', 'animate(', '.animate(', 'transition:']
    return any(p.lower() in html_content.lower() for p in anim_patterns)


def has_video(html_content):
    """Check for video elements."""
    return bool(re.search(r'<video|\.mp4|\.webm|\.mov|videoPlayer|playVideo', html_content, re.I))


def extract_function_body(content, func_start_pos):
    """Extract a function body using brace depth counting, starting after the opening {."""
    depth = 1
    pos = func_start_pos
    while depth > 0 and pos < len(content):
        ch = content[pos]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        pos += 1
    return content[func_start_pos:pos - 1] if depth == 0 else None


def extract_click_handlers(html_content):
    """Extract all click handler patterns from HTML."""
    handlers = []

    # exits(event) function — use brace counting for multi-line bodies
    exits_sig = re.search(r'function\s+exits?\s*\([^)]*\)\s*\{', html_content)
    if exits_sig:
        body_start = exits_sig.end()
        body = extract_function_body(html_content, body_start)
        if body:
            full_func = exits_sig.group(0) + body + '}'
            handlers.append({
                'type': 'exits(event)',
                'body': full_func.strip(),
                'urls': re.findall(r'https?://[^\s"\'<>]+', body)
            })

    # Enabler.exit() calls
    enabler_exits = re.findall(r'Enabler\.exit\s*\(\s*["\']([^"\']*)["\'](?:\s*,\s*["\']([^"\']*)["\'])?\s*\)', html_content)
    for match in enabler_exits:
        handlers.append({
            'type': 'Enabler.exit()',
            'id': match[0],
            'url': match[1] if len(match) > 1 else ''
        })

    # window.open() calls
    window_opens = re.findall(r'window\.open\s*\(\s*["\']([^"\']+)["\']', html_content)
    for url in window_opens:
        handlers.append({'type': 'window.open()', 'url': url})

    # onclick attributes
    onclicks = re.findall(r'onclick=["\']([^"\']+)["\']', html_content)
    for handler in onclicks:
        urls = re.findall(r'https?://[^\s"\'<>\\]+', handler)
        handlers.append({'type': 'onclick', 'handler': handler, 'urls': urls})

    # <a href> links (non-anchor, non-javascript)
    a_hrefs = re.findall(r'<a\s[^>]*href=["\']([^"\'#][^"\']*)["\'][^>]*>', html_content, re.I)
    for href in a_hrefs:
        if not href.startswith('javascript:void') and not href.startswith('#'):
            handlers.append({'type': '<a href>', 'url': href})

    # <area> image maps
    areas = re.findall(r'<area\s[^>]*href=["\']([^"\']+)["\'][^>]*>', html_content, re.I)
    for href in areas:
        handlers.append({'type': '<area>', 'url': href})

    # clickTag variables
    clicktags = re.findall(r'(?:var\s+)?clickTag\w*\s*=\s*["\']([^"\']+)["\']', html_content)
    for url in clicktags:
        handlers.append({'type': 'clickTag', 'url': url})

    # openExternalLinkFull / openExternalPDF (refactored pattern)
    # Direct URL calls
    ext_links = re.findall(r'openExternalLinkFull\s*\(\s*["\']([^"\']*)["\']', html_content)
    for url in ext_links:
        handlers.append({'type': 'openExternalLinkFull', 'url': url})

    ext_pdfs = re.findall(r'openExternalPDF\s*\(\s*["\']([^"\']*)["\']', html_content)
    for url in ext_pdfs:
        handlers.append({'type': 'openExternalPDF', 'url': url})

    # Also map clickTag variable calls: openExternalLinkFull(e, clickTag1) -> resolve clickTag1's URL
    # Build a map of clickTag var names to URLs
    clicktag_map = {}
    for m in re.finditer(r'var\s+(clickTag\w*)\s*=\s*["\']([^"\']+)["\']', html_content):
        clicktag_map[m.group(1)] = m.group(2)

    # Find handler calls using variable names: openExternalLinkFull(e, clickTag1)
    for m in re.finditer(r'(openExternalLinkFull|openExternalPDF)\s*\(\s*\w+\s*,\s*(\w+)\s*\)', html_content):
        handler_type = m.group(1)
        var_name = m.group(2)
        if var_name in clicktag_map:
            url = clicktag_map[var_name]
            # Avoid duplicating if we already captured this URL via direct string match
            already_captured = any(h.get('url') == url and h['type'] == handler_type for h in handlers)
            if not already_captured:
                handlers.append({
                    'type': handler_type,
                    'url': url,
                    'element_var': var_name
                })

    return handlers


def extract_isi_structure(html_content):
    """Extract ISI container structure."""
    isi_info = {}

    # Find ISI containers by ID or class
    isi_ids = re.findall(r'id=["\']([^"\']*isi[^"\']*)["\']', html_content, re.I)
    isi_classes = re.findall(r'class=["\']([^"\']*isi[^"\']*)["\']', html_content, re.I)

    isi_info['container_ids'] = isi_ids
    isi_info['container_classes'] = isi_classes

    # Check if ISI is image or text
    # Method 1: ISI-named image files referenced anywhere
    isi_img = bool(re.search(r'isi[^"\']*\.(png|jpg|gif|svg)', html_content, re.I))
    # Method 2: <img> tag inside an ISI container (look for img near isi IDs/classes)
    if not isi_img:
        # Check if innerMostDiv contains an <img> (common refactored pattern)
        inner_match = re.search(r'id=["\']innerMostDiv["\'][^>]*>([\s\S]*?)</div>', html_content, re.I)
        if inner_match and '<img' in inner_match.group(1):
            isi_img = True
    # Method 3: Check for img tags near ISI container IDs
    if not isi_img:
        for isi_id in isi_ids:
            pattern = r'id=["\']' + re.escape(isi_id) + r'["\'][^>]*>[\s\S]{0,500}<img\s'
            if re.search(pattern, html_content, re.I):
                isi_img = True
                break

    # Live text detection: look for paragraph-like ISI content (bold text, bullet points, drug names)
    isi_text = bool(re.search(r'(?:important\s+safety|indication|contraindication|boxed\s+warning|'
                              r'adverse\s+reaction|warning.*precaution|drug\s+interaction)', html_content, re.I))

    isi_info['is_image'] = isi_img
    isi_info['is_text'] = isi_text and not isi_img

    # Check for outerMostDiv/innerMostDiv pattern (refactored)
    isi_info['has_outerMostDiv'] = 'outerMostDiv' in html_content
    isi_info['has_isi_controls'] = 'isi-controls' in html_content or 'isi-footer' in html_content

    # Check for multiple sibling ISI containers
    isi_info['has_sibling_containers'] = len(isi_ids) > 1

    # Check for expandable ISI
    isi_info['is_expandable'] = bool(re.search(
        r'expand.*isi|isi.*expand|toggle.*isi|isi.*toggle|isi.*collapse|collapse.*isi',
        html_content, re.I))

    return isi_info


ES6_CHECKS = {
    'const': r'\bconst\s+',
    'let': r'\blet\s+',
    'arrow_function': r'=>',
    'template_literal': r'`[^`]*`',
    'async_await': r'\b(?:async|await)\b',
    'destructuring': r'(?:const|let|var)\s*[\[{]',
    'spread_operator': r'\.\.\.',
    'class': r'\bclass\s+\w+',
    'Promise': r'\bPromise\b',
    'fetch': r'\bfetch\s*\(',
}


def find_es6_patterns_raw(js_content):
    """Find ES6+ syntax in raw JS content (not wrapped in script tags)."""
    patterns = {}
    for name, pattern in ES6_CHECKS.items():
        matches = re.findall(pattern, js_content)
        if matches:
            patterns[name] = len(matches)
    return patterns


def find_es6_patterns(html_content):
    """Find ES6+ syntax in inline scripts within HTML."""
    scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', html_content, re.I)
    all_script = '\n'.join(scripts)
    return find_es6_patterns_raw(all_script)


def find_unusual_patterns(html_content):
    """Flag unusual patterns."""
    unusual = []

    # Scroll libraries
    scroll_libs = {
        'iScroll': r'iscroll',
        'OverlayScrollbars': r'overlayscrollbar',
        'mCustomScrollbar': r'mcustomscrollbar',
        'SimpleBar': r'simplebar',
    }
    for name, pattern in scroll_libs.items():
        if re.search(pattern, html_content, re.I):
            unusual.append(f'Scroll library: {name}')

    # Animation libraries (non-GSAP/CSS)
    if re.search(r'anime\.js|velocity\.js|popmotion|framer-motion', html_content, re.I):
        unusual.append('Non-standard animation library found')

    # Video
    if has_video(html_content):
        unusual.append('Video content present')

    # Expandable ISI
    if re.search(r'expand.*isi|isi.*expand|toggle.*isi|isi.*toggle', html_content, re.I):
        unusual.append('Expandable ISI')

    # Modal/overlay — require it as an id, class attribute value, or JS function to reduce false positives
    # (avoids matching CSS like "overlay-bg" used for simple positioned divs)
    if re.search(r'(?:id|class)=["\'][^"\']*(?:modal|lightbox)[^"\']*["\']', html_content, re.I) or \
       re.search(r'(?:showModal|openModal|closeModal|toggleModal|\.modal\()', html_content):
        unusual.append('Modal/overlay content')

    # Image maps
    if re.search(r'<map|<area', html_content, re.I):
        unusual.append('Image map (<map>/<area>)')

    # Google Fonts
    if re.search(r'fonts\.googleapis\.com', html_content, re.I):
        unusual.append('Google Fonts CDN')

    # Other CDN
    if re.search(r'cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com', html_content, re.I):
        unusual.append('External CDN dependencies')

    # Polite loader
    if re.search(r'polite|onLoaderReady|PoliteLoad', html_content, re.I):
        unusual.append('Polite loader pattern')

    # CSS variables / Grid
    if re.search(r'var\(--', html_content):
        unusual.append('CSS variables (Chrome 69 concern)')
    if re.search(r'display:\s*grid', html_content, re.I):
        unusual.append('CSS Grid (Chrome 69 concern)')

    # Iframes
    if re.search(r'<iframe', html_content, re.I):
        unusual.append('Iframe usage')

    return unusual


# --- File Discovery ---

def find_iads_jobs():
    """Find all IADS-7000+ job folders that have HTML in 2_Assets."""
    jobs = []
    for brand_dir in sorted(BASE_DIR.iterdir()):
        if not brand_dir.is_dir():
            continue
        try:
            sub_entries = sorted(brand_dir.iterdir())
        except (PermissionError, OSError):
            continue
        for job_dir in sub_entries:
            if not job_dir.is_dir():
                continue
            m = re.search(r'IADS-(\d+)', job_dir.name)
            if not m:
                continue
            iads_num = int(m.group(1))
            if iads_num < MIN_IADS:
                continue

            # Check for assets folder with HTML
            assets_dir = None
            for name in ('2_Assets', 'Assets'):
                candidate = job_dir / name
                if candidate.is_dir():
                    assets_dir = candidate
                    break

            if not assets_dir:
                continue

            # Find HTML files in assets
            html_files = []
            try:
                for root, dirs, files in os.walk(str(assets_dir)):
                    depth = root.replace(str(assets_dir), '').count(os.sep)
                    if depth > 3:
                        dirs.clear()
                        continue
                    for f in files:
                        if f.lower().endswith(('.html', '.htm')):
                            html_files.append(os.path.join(root, f))
            except OSError:
                continue

            if not html_files:
                continue

            # Find highest R folder
            routing_dir = None
            for name in ('4_Routing', 'Routing'):
                candidate = job_dir / name
                if candidate.is_dir():
                    routing_dir = candidate
                    break

            if not routing_dir:
                continue

            try:
                r_folders = [d.name for d in routing_dir.iterdir() if d.is_dir() and re.match(r'^R\d+$', d.name)]
            except OSError:
                continue

            if not r_folders:
                continue

            r_folders.sort(key=lambda x: int(x[1:]))
            highest_r = r_folders[-1]

            refactored_html = routing_dir / highest_r / 'HTML' / 'index.html'
            if not refactored_html.exists():
                continue

            jobs.append({
                'brand': brand_dir.name,
                'folder': job_dir.name,
                'path': job_dir,
                'iads_num': iads_num,
                'assets_dir': assets_dir,
                'original_html_files': html_files,
                'routing_dir': routing_dir,
                'highest_r': highest_r,
                'refactored_html': refactored_html,
                'refactored_dir': routing_dir / highest_r / 'HTML',
            })

    return jobs


def read_original_js_files(assets_dir, html_files):
    """Read all JS files from the original assets directory (siblings/children of HTML files)."""
    js_contents = []
    js_dirs = set()

    # Collect directories containing HTML files — JS is usually nearby
    for f in html_files:
        js_dirs.add(os.path.dirname(f))
        # Also check js/ and script/ subdirs
        parent = os.path.dirname(f)
        for sub in ('js', 'script', 'scripts', 'lib'):
            candidate = os.path.join(parent, sub)
            if os.path.isdir(candidate):
                js_dirs.add(candidate)

    for js_dir in js_dirs:
        try:
            for fname in os.listdir(js_dir):
                if not fname.lower().endswith('.js'):
                    continue
                # Skip known library files — we want app code
                if any(skip in fname.lower() for skip in ('jquery', 'gsap', 'tweenmax', 'tweenlite',
                                                           'timelinemax', 'iscroll', 'scrollbar',
                                                           'simplebar', '.min.js')):
                    continue
                content = read_file_safe(os.path.join(js_dir, fname))
                if content:
                    js_contents.append(content)
        except OSError:
            continue

    return '\n'.join(js_contents)


def analyze_ad(job):
    """Analyze a single ad pair."""
    result = {
        'folder': job['folder'],
        'brand': job['brand'],
        'iads_num': job['iads_num'],
        'highest_r': job['highest_r'],
    }

    # Read original HTML (pick the main one - prefer index.html, then largest file)
    original_contents = {}
    main_original = None
    for f in job['original_html_files']:
        content = read_file_safe(f)
        if content:
            original_contents[f] = content
            fname = os.path.basename(f).lower()
            if fname == 'index.html' and main_original is None:
                main_original = content
            elif 'preview' not in fname and 'gwd_preview' not in f:
                if main_original is None:
                    main_original = content

    if not main_original and original_contents:
        # Use the largest file
        main_original = max(original_contents.values(), key=len)

    if not main_original:
        result['error'] = 'Could not read original HTML'
        return result

    # Read original external JS files (exits(), click handlers often live here)
    original_js = read_original_js_files(job['assets_dir'], job['original_html_files'])
    # Combined original content for click handler and ES6 extraction
    original_combined = main_original + '\n' + original_js

    # Read refactored HTML
    refactored = read_file_safe(str(job['refactored_html']))
    if not refactored:
        result['error'] = 'Could not read refactored HTML'
        return result

    # Also read refactored ad.js if it exists (check multiple common paths)
    refactored_js_parts = []
    for js_subdir in ('script', 'js', 'scripts'):
        for js_name in ('ad.js', 'main.js'):
            js_path = job['refactored_dir'] / js_subdir / js_name
            if js_path.exists():
                content = read_file_safe(str(js_path))
                if content:
                    refactored_js_parts.append(content)

    refactored_full = refactored + '\n' + '\n'.join(refactored_js_parts)

    # 1. Metadata
    w, h = extract_meta_ad_size(main_original)
    if not w:
        w, h = extract_meta_ad_size(refactored)
    result['dimensions'] = f'{w}x{h}' if w and h else 'Unknown'
    result['brand_type'] = detect_brand_type(w, h, job['folder'])
    result['is_gwd'] = is_gwd(main_original)
    result['language'] = detect_language(main_original)
    result['has_isi'] = has_isi(original_combined) or has_isi(refactored)
    result['has_animation'] = has_animation(original_combined)
    result['has_video'] = has_video(original_combined) or has_video(refactored)

    # 2. Click handlers — search HTML + external JS files
    result['original_clicks'] = extract_click_handlers(original_combined)
    result['refactored_clicks'] = extract_click_handlers(refactored_full)

    # 3. ISI structure
    if result['has_isi']:
        result['original_isi'] = extract_isi_structure(main_original)
        result['refactored_isi'] = extract_isi_structure(refactored_full)
    else:
        result['original_isi'] = None
        result['refactored_isi'] = None

    # 4. Files changed — normalize paths to just filename or last 2 segments
    # Original assets are often nested in zip-extracted subfolders; normalize to comparable basenames
    def normalize_file_path(rel_path):
        """Normalize to just the filename, or subdir/filename for common structures."""
        parts = Path(rel_path).parts
        # Skip .DS_Store, __MACOSX, etc.
        if any(p.startswith('.') or p == '__MACOSX' for p in parts):
            return None
        # Skip .zip files
        if rel_path.lower().endswith('.zip'):
            return None
        # Skip .psd, .ai, .pdf source files (not part of the HTML ad)
        if rel_path.lower().endswith(('.psd', '.ai', '.pdf', '.indd', '.eps')):
            return None
        fname = parts[-1]
        # If file is in a recognized subdir (assets/, img/, css/, js/, script/), keep subdir/file
        if len(parts) >= 2:
            parent = parts[-2].lower()
            if parent in ('assets', 'img', 'images', 'css', 'js', 'script', 'scripts',
                          'fonts', 'font', 'lib', 'controls', 'video'):
                return f'{parts[-2]}/{fname}'
        return fname

    original_files_raw = set()
    try:
        for root, dirs, files in os.walk(str(job['assets_dir'])):
            depth = root.replace(str(job['assets_dir']), '').count(os.sep)
            if depth > 4:
                dirs.clear()
                continue
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), str(job['assets_dir']))
                normalized = normalize_file_path(rel)
                if normalized:
                    original_files_raw.add(normalized)
    except OSError:
        pass

    refactored_files_raw = set()
    try:
        for root, dirs, files in os.walk(str(job['refactored_dir'])):
            depth = root.replace(str(job['refactored_dir']), '').count(os.sep)
            if depth > 3:
                dirs.clear()
                continue
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), str(job['refactored_dir']))
                normalized = normalize_file_path(rel)
                if normalized:
                    refactored_files_raw.add(normalized)
    except OSError:
        pass

    result['original_files'] = sorted(original_files_raw)
    result['refactored_files'] = sorted(refactored_files_raw)
    result['added_files'] = sorted(refactored_files_raw - original_files_raw)
    result['removed_files'] = sorted(original_files_raw - refactored_files_raw)

    # 5. ES6 patterns in original (HTML inline scripts + external JS)
    es6_from_html = find_es6_patterns(main_original)
    es6_from_js = find_es6_patterns_raw(original_js) if original_js else {}
    # Merge counts
    merged_es6 = dict(es6_from_html)
    for k, v in es6_from_js.items():
        merged_es6[k] = merged_es6.get(k, 0) + v
    result['es6_patterns'] = merged_es6

    # 6. Unusual patterns — scan HTML + external JS for originals
    result['unusual_original'] = find_unusual_patterns(original_combined)
    result['unusual_refactored'] = find_unusual_patterns(refactored_full)

    return result


# --- Report Generation ---

def format_click_handlers(handlers, label):
    """Format click handlers for markdown output."""
    if not handlers:
        return f"**{label}:** No click handlers found\n"

    lines = [f"**{label}:**\n"]
    for h in handlers:
        if h['type'] == 'exits(event)':
            lines.append(f"- `exits(event)` function:\n```js\n{h['body']}\n```\n")
            if h.get('urls'):
                for url in h['urls']:
                    lines.append(f"  - URL: `{url}`\n")
        elif h['type'] == 'Enabler.exit()':
            lines.append(f"- `Enabler.exit('{h['id']}'")
            if h.get('url'):
                lines.append(f", '{h['url']}')`\n")
            else:
                lines.append(")`\n")
        elif h['type'] in ('window.open()', '<a href>', '<area>', 'clickTag', 'openExternalLinkFull', 'openExternalPDF'):
            extra = f" (via `{h['element_var']}`)" if h.get('element_var') else ''
            lines.append(f"- `{h['type']}`: `{h.get('url', '')}`{extra}\n")
        elif h['type'] == 'onclick':
            lines.append(f"- `onclick`: `{h.get('handler', '')[:100]}`\n")
            for url in h.get('urls', []):
                lines.append(f"  - URL: `{url}`\n")
    return ''.join(lines)


def generate_report(results):
    """Generate the full REFACTOR_ANALYSIS.md report."""
    lines = []
    lines.append(f"# Refactor Analysis Report\n")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    lines.append(f"Total ads analyzed: {len(results)}\n\n")
    lines.append("---\n\n")

    # Tracking for summary
    click_patterns = Counter()
    refactored_handler_types = Counter()
    isi_types = Counter()
    isi_expandable_count = 0
    es6_totals = Counter()
    all_unusual = []
    unique_ads = {}  # For recommended files

    for r in results:
        lines.append(f"## {r['folder']}\n\n")

        if 'error' in r:
            lines.append(f"**Error:** {r['error']}\n\n---\n\n")
            continue

        # 1. Metadata
        lines.append("### 1. Ad Metadata\n")
        lines.append(f"- **Folder:** `{r['folder']}`\n")
        lines.append(f"- **IADS #:** {r['iads_num']}\n")
        lines.append(f"- **Dimensions:** {r['dimensions']}\n")
        lines.append(f"- **Brand Type:** {r['brand_type']}\n")
        lines.append(f"- **GWD Ad:** {'Yes' if r['is_gwd'] else 'No'}\n")
        lines.append(f"- **Language:** {r['language']}\n")
        lines.append(f"- **Has ISI:** {'Yes' if r['has_isi'] else 'No'}\n")
        lines.append(f"- **Has Animation:** {'Yes' if r['has_animation'] else 'No'}\n")
        lines.append(f"- **Has Video:** {'Yes' if r['has_video'] else 'No'}\n")
        lines.append(f"- **Highest Routing:** {r['highest_r']}\n\n")

        # 2. Click handlers
        lines.append("### 2. Click Handler Mapping\n\n")
        lines.append(format_click_handlers(r['original_clicks'], 'Original'))
        lines.append("\n")
        lines.append(format_click_handlers(r['refactored_clicks'], 'Refactored'))
        lines.append("\n")

        # Track click patterns
        for h in r['original_clicks']:
            click_patterns[h['type']] += 1
        for h in r['refactored_clicks']:
            if h['type'] in ('openExternalLinkFull', 'openExternalPDF'):
                refactored_handler_types[h['type']] += 1

        # 3. ISI
        if r['has_isi'] and r['original_isi']:
            lines.append("### 3. ISI Structure\n\n")
            oi = r['original_isi']
            ri = r['refactored_isi']

            lines.append("**Original ISI:**\n")
            if oi['container_ids']:
                lines.append(f"- Container IDs: {', '.join(f'`{x}`' for x in oi['container_ids'])}\n")
            if oi['container_classes']:
                lines.append(f"- Container Classes: {', '.join(f'`{x}`' for x in oi['container_classes'][:5])}\n")
            isi_type = 'Image' if oi['is_image'] else ('Live HTML text' if oi['is_text'] else 'Unknown')
            lines.append(f"- Type: {isi_type}\n")
            lines.append(f"- Multiple sibling containers: {'Yes' if oi['has_sibling_containers'] else 'No'}\n\n")

            if ri:
                lines.append("**Refactored ISI:**\n")
                lines.append(f"- Uses outerMostDiv/innerMostDiv: {'Yes' if ri['has_outerMostDiv'] else 'No'}\n")
                lines.append(f"- Has ISI controls: {'Yes' if ri['has_isi_controls'] else 'No'}\n")
                ref_isi_type = 'Image' if ri['is_image'] else ('Live HTML text' if ri['is_text'] else 'Unknown')
                lines.append(f"- Type: {ref_isi_type}\n")
                lines.append(f"- Converted text to image: {'Yes' if oi['is_text'] and ri['is_image'] else 'No'}\n\n")

            # Track ISI types
            isi_types[isi_type] += 1
            if oi.get('is_expandable'):
                isi_expandable_count += 1
        else:
            lines.append("### 3. ISI Structure\n\nNo ISI present.\n\n")

        # 4. Files changed
        lines.append("### 4. Files Changed\n\n")
        if r['added_files']:
            lines.append("**Added:**\n")
            for f in r['added_files'][:15]:
                lines.append(f"- `{f}`\n")
            if len(r['added_files']) > 15:
                lines.append(f"- ... and {len(r['added_files']) - 15} more\n")
            lines.append("\n")

        if r['removed_files']:
            lines.append("**Removed:**\n")
            for f in r['removed_files'][:15]:
                lines.append(f"- `{f}`\n")
            if len(r['removed_files']) > 15:
                lines.append(f"- ... and {len(r['removed_files']) - 15} more\n")
            lines.append("\n")

        # 5. ES6
        if r['es6_patterns']:
            lines.append("### 5. ES6+ Syntax in Original\n\n")
            for pattern, count in r['es6_patterns'].items():
                lines.append(f"- **{pattern}**: {count} instance(s)\n")
                es6_totals[pattern] += count
            lines.append("\n")

        # 6. Unusual patterns
        all_unusual_this = r['unusual_original'] + r['unusual_refactored']
        if all_unusual_this:
            lines.append("### 6. Unusual Patterns\n\n")
            for p in set(all_unusual_this):
                lines.append(f"- {p}\n")
                all_unusual.append(f"{p} ({r['folder']})")
            lines.append("\n")

            # Track for recommended files
            for p in all_unusual_this:
                if p not in unique_ads:
                    unique_ads[p] = r['folder']

        lines.append("---\n\n")

    # --- Summary ---
    lines.append("# Summary\n\n")

    lines.append("## Click Pattern Frequency\n\n")
    lines.append("| Pattern | Count | Example Ad |\n")
    lines.append("|---------|-------|------------|\n")
    for pattern, count in click_patterns.most_common():
        # Find an example
        example = next((r['folder'] for r in results if any(h['type'] == pattern for h in r.get('original_clicks', []))), 'N/A')
        lines.append(f"| {pattern} | {count} | {example} |\n")
    lines.append("\n")

    lines.append("## ISI Type Frequency\n\n")
    lines.append("| Type | Count | Example Ad |\n")
    lines.append("|------|-------|------------|\n")
    for isi_type, count in isi_types.most_common():
        example = next((r['folder'] for r in results if r.get('original_isi') and
                        (r['original_isi'].get('is_image') if isi_type == 'Image' else r['original_isi'].get('is_text'))), 'N/A')
        lines.append(f"| {isi_type} | {count} | {example} |\n")
    lines.append("\n")

    if isi_expandable_count:
        lines.append(f"**Expandable ISI ads:** {isi_expandable_count}\n\n")

    lines.append("## Refactored Handler Types\n\n")
    lines.append("| Handler | Count |\n")
    lines.append("|---------|-------|\n")
    for handler, count in refactored_handler_types.most_common():
        lines.append(f"| {handler} | {count} |\n")
    lines.append("\n")

    lines.append("## Most Common ES6 Patterns\n\n")
    lines.append("| Pattern | Count |\n")
    lines.append("|---------|-------|\n")
    for pattern, count in es6_totals.most_common():
        lines.append(f"| {pattern} | {count} |\n")
    lines.append("\n")

    lines.append("## Unusual Patterns Found\n\n")
    if all_unusual:
        for p in sorted(set(all_unusual)):
            lines.append(f"- {p}\n")
    else:
        lines.append("None found.\n")
    lines.append("\n")

    lines.append("## Recommended Files to Pull\n\n")
    lines.append("These ads represent unique patterns worth testing:\n\n")
    # Pick diverse examples — one per category, no limit
    recommended_categories = [
        ('GWD Ad', lambda r: r.get('is_gwd')),
        ('exits() handler', lambda r: any(h['type'] == 'exits(event)' for h in r.get('original_clicks', []))),
        ('Enabler.exit() handler', lambda r: any(h['type'] == 'Enabler.exit()' for h in r.get('original_clicks', []))),
        ('Video content', lambda r: r.get('has_video')),
        ('Spanish language', lambda r: r.get('language') == 'Spanish'),
        ('Scroll library: iScroll', lambda r: any('iScroll' in p for p in r.get('unusual_original', []))),
        ('Scroll library: mCustomScrollbar', lambda r: any('mCustomScrollbar' in p for p in r.get('unusual_original', []))),
        ('Scroll library: OverlayScrollbars', lambda r: any('OverlayScrollbars' in p for p in r.get('unusual_original', []))),
        ('Image map', lambda r: any('Image map' in p for p in r.get('unusual_original', []))),
        ('Expandable ISI', lambda r: r.get('original_isi', {}).get('is_expandable') if r.get('original_isi') else False),
        ('Live HTML ISI', lambda r: r.get('original_isi', {}).get('is_text') if r.get('original_isi') else False),
        ('Google Fonts CDN', lambda r: any('Google Fonts' in p for p in r.get('unusual_original', []))),
        ('Polite loader', lambda r: any('Polite loader' in p for p in r.get('unusual_original', []))),
        ('CSS variables', lambda r: any('CSS variables' in p for p in r.get('unusual_original', []))),
        ('Iframe usage', lambda r: any('Iframe' in p for p in r.get('unusual_original', []))),
        ('Modal content', lambda r: any('Modal' in p for p in r.get('unusual_original', []))),
    ]
    seen_folders = set()
    for category, check_fn in recommended_categories:
        example = next((r for r in results if 'error' not in r and check_fn(r) and r['folder'] not in seen_folders), None)
        if example:
            lines.append(f"- **{category}**: `{example['folder']}`\n")
            seen_folders.add(example['folder'])
    lines.append("\n")

    return ''.join(lines)


# --- Main ---

def main():
    dry_run = '--dry-run' in sys.argv
    limit = 5 if dry_run else DRY_RUN_LIMIT

    print(f"{'DRY RUN - ' if dry_run else ''}Scanning for IADS-{MIN_IADS}+ jobs with HTML in Assets...")
    jobs = find_iads_jobs()
    print(f"Found {len(jobs)} qualifying jobs.")

    if limit:
        # Pick diverse sample
        sample_indices = []
        types_seen = set()
        for i, j in enumerate(jobs):
            suffix = j['folder'].split('_')[-1].lower()
            if suffix not in types_seen:
                types_seen.add(suffix)
                sample_indices.append(i)
            if len(sample_indices) >= limit:
                break
        if len(sample_indices) < limit:
            for i in range(len(jobs)):
                if i not in sample_indices:
                    sample_indices.append(i)
                if len(sample_indices) >= limit:
                    break
        jobs = [jobs[i] for i in sample_indices[:limit]]
        print(f"Limited to {len(jobs)} jobs for dry run: {[j['folder'] for j in jobs]}")

    results = []
    for i, job in enumerate(jobs):
        print(f"[{i+1}/{len(jobs)}] Analyzing {job['folder']}...", flush=True)
        try:
            result = analyze_ad(job)
            results.append(result)
            if 'error' in result:
                print(f"  WARNING: {result['error']}")
            else:
                print(f"  OK - {result['brand_type']}, GWD={result['is_gwd']}, ISI={result['has_isi']}, "
                      f"Clicks(orig)={len(result['original_clicks'])}, Clicks(ref)={len(result['refactored_clicks'])}")
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({'folder': job['folder'], 'brand': job['brand'], 'iads_num': job['iads_num'],
                           'highest_r': job.get('highest_r', '?'), 'error': str(e)})

    print("\nGenerating report...")
    report = generate_report(results)

    suffix = '_DRYRUN' if dry_run else ''
    output_path = BASE_DIR / f'REFACTOR_ANALYSIS{suffix}.md'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\nReport saved to: {output_path}")

    # Also save a copy to the ad_builder project for easy access
    local_copy = Path("/Users/Philip.Kowalski/Desktop/ad_builder") / f'REFACTOR_ANALYSIS{suffix}.md'
    try:
        with open(local_copy, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"Local copy saved to: {local_copy}")
    except OSError as e:
        print(f"Could not save local copy: {e}")

    print(f"Total ads: {len(results)}, Errors: {sum(1 for r in results if 'error' in r)}")


if __name__ == '__main__':
    main()
