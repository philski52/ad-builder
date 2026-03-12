// Template code generator
// Generates HTML, JS, and CSS based on template type and configuration

import { hasFeature } from '../templates';

/**
 * Generate all template code files
 */
export function generateTemplateCode(
  template,
  config,
  assets,
  animations = [],
) {
  const hasISI = hasFeature(template, 'isi');
  const hasVideo = hasFeature(template, 'video');
  const hasButtons = hasVideo && config.buttonCount > 0;
  const hasClickZones = (config.clickZones || []).length > 0;

  const result = {
    html: generateHTML(template, config, assets, animations),
    js: generateAdJS(config),
    css: generateCSS(config),
  };

  if (hasISI) {
    result.scrollerCss = generateScrollerCSS(config);
    result.mainJs = generateMainJS(config);
  }

  if (hasButtons) {
    result.buttonsCss = generateButtonsCSS(config);
  }

  if (hasClickZones) {
    result.clicksCss = generateClicksCSS(config);
  }

  return result;
}

/**
 * Format properties for TweenMax
 */
function formatAnimProps(props) {
  const parts = Object.entries(props).map(([k, v]) => {
    if (k === 'ease') return `${k}: ${v}`;
    if (typeof v === 'string') return `${k}: "${v}"`;
    return `${k}: ${v}`;
  });
  return '{ ' + parts.join(', ') + ' }';
}

/**
 * Generate TweenMax animation JS from animation data array
 */
function generateAnimationJS(animations) {
  if (!animations || animations.length === 0) return '';

  const sorted = [...animations].sort((a, b) => a.startTime - b.startTime);
  const setLines = [];
  const toLines = [];
  const initialized = new Set();

  for (const anim of sorted) {
    const sel = `"#${anim.target}"`;
    const props = {};
    const initProps = {};

    if (anim.effects.autoAlpha !== undefined) {
      props.autoAlpha = anim.effects.autoAlpha.to;
      initProps.autoAlpha = anim.effects.autoAlpha.from;
    }
    if (anim.effects.x !== undefined) {
      props.x = anim.effects.x.to;
      initProps.x = anim.effects.x.from;
    }
    if (anim.effects.y !== undefined) {
      props.y = anim.effects.y.to;
      initProps.y = anim.effects.y.from;
    }
    if (anim.effects.rotation !== undefined) {
      props.rotation = anim.effects.rotation.to;
      initProps.rotation = anim.effects.rotation.from;
    }
    if (anim.effects.scale !== undefined) {
      props.scale = anim.effects.scale.to;
      initProps.scale = anim.effects.scale.from;
    }
    if (anim.easing && anim.easing !== 'none') {
      props.ease = anim.easing;
    }

    if (!initialized.has(anim.target) && Object.keys(initProps).length > 0) {
      initialized.add(anim.target);
      setLines.push(`    TweenMax.set(${sel}, ${formatAnimProps(initProps)});`);
    }

    const label =
      anim.target.replace(/([a-z])(\d)/, '$1 $2').toUpperCase() +
      ' - ' +
      (anim.type === 'in' ? 'IN' : 'OUT');
    toLines.push(`    //${label}`);
    toLines.push(
      `    tl.to(${sel}, ${anim.duration}, ${formatAnimProps(props)}, ${anim.startTime});`,
    );
  }

  return `
var firstPlay = true;
var tl = new TimelineMax({});
function createAnimation() {
${setLines.join('\n')}
${toLines.join('\n')}
}
function onWallboardIdleSlideDisplay() {
    var el = document.getElementById("innerMostDiv");
    if (el) el.scrollTop = 0;
    if (firstPlay) { createAnimation(); tl.play(); firstPlay = false; }
    else { tl.seek(0); tl.play(); }
}
if (typeof appHost === 'undefined' || !appHost) { onWallboardIdleSlideDisplay(); }
window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'replayAnimation') {
        if (firstPlay) { createAnimation(); firstPlay = false; }
        tl.restart();
    }
});
`;
}

/**
 * Generate index.html
 */
export function generateHTML(template, config, assets, animations) {
  const hasISI = hasFeature(template, 'isi');
  const hasAnimation = hasFeature(template, 'animation');
  const hasVideo = hasFeature(template, 'video');
  const buttonCount = config.buttonCount || 0;
  const clickZones = config.clickZones || [];
  const anims = animations || [];

  // Generate frame HTML for animated templates
  const frames = assets.frames || [];
  let framesHTML = '';
  if (hasAnimation && frames.length > 0) {
    framesHTML = frames
      .map(
        (_, i) => `
        <div id="frame${i + 1}">
            <img src="assets/frame${i + 1}.png" width="${config.dimensions.width}">
        </div>`,
      )
      .join('');
  }

  // Generate button HTML
  const buttonsHTML =
    hasVideo && buttonCount > 0
      ? Array.from({ length: buttonCount }, (_, i) => {
          const btn = config.buttons[i] || {};
          return `<div id="ctaButton${i + 1}" class="cta-button">${btn.text || `Button ${i + 1}`}</div>`;
        }).join('\n        ')
      : '';

  // Generate click zone HTML - non-ISI zones (go in container)
  const containerZonesHTML = clickZones
    .filter((z) => !z.inISI)
    .map((z) => `<div id="${z.id}" class="click-zone"></div>`)
    .join('\n        ');

  // Generate click zone HTML - ISI zones (go in innerMostDiv)
  const isiZonesHTML = clickZones
    .filter((z) => z.inISI)
    .map((z) => `<div id="${z.id}" class="click-zone"></div>`)
    .join('\n                ');

  const hasClickZones = clickZones.length > 0;

  // Generate animation JS
  const animationScript = generateAnimationJS(anims);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <meta name="ad.size" content="width=${config.dimensions.width},height=${config.dimensions.height}">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <title>Ad</title>
    <script>var appHost = null; try { appHost = window.appHost = window.top.AppHost ? new window.top.AppHost(this) : null; } catch(e) { window.appHost = null; }<\/script>
    <script src="https://code.jquery.com/jquery-2.1.4.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/2.0.1/TweenMax.min.js"><\/script>
    <link rel="stylesheet" href="css/main.css">
    ${hasISI ? `<link rel="stylesheet" href="css/scroller.css">` : ''}
    ${hasClickZones ? `<link rel="stylesheet" href="css/clicks.css">` : ''}
    ${hasVideo && buttonCount > 0 ? `<link rel="stylesheet" href="css/buttons.css">` : ''}
</head>
<body>
    <div id="container">
        ${!hasVideo ? `<img class="background" src="assets/background.png" width="${config.dimensions.width}px">` : ''}
        ${framesHTML}
        ${containerZonesHTML}
        ${
          hasISI
            ? `
        <div id="outerMostDiv">
            <div id="innerMostDiv">
                <div id="isi-content-wrapper">
                    <img id="ISI_guts" src="assets/isi.png" width="${config.isiWidth || config.dimensions.width}px">
                    ${isiZonesHTML}
                </div>
            </div>
            <div id="isi-controls"></div>
        </div>`
            : ''
        }
        ${hasVideo ? `<video id="videoId" autoplay width="900" height="${config.videoHeight || 60}"><source src="assets/video.mp4" type="video/mp4" /></video>` : ''}
        ${buttonsHTML}
    </div>
    <script src="script/ad.js"><\/script>
    ${hasISI ? `<script src="script/main.js"><\/script>` : ''}
    ${animationScript ? `<script>${animationScript}<\/script>` : ''}

</body>
</html>`;
}

/**
 * Generate ad.js (click handlers)
 */
export function generateAdJS(config) {
  const clickZones = config.clickZones || [];
  const globalJobId = config.jobId || '';

  // Generate clickTag variable declarations
  const clickTagVars = clickZones
    .map((zone, i) => {
      const varName = zone.id.replace(/[^a-zA-Z0-9]/g, '_');
      return `    var ${varName} = "${zone.url}";`;
    })
    .join('\n');

  // Generate click handlers based on link type
  const clickHandlers = clickZones
    .map((zone) => {
      const varName = zone.id.replace(/[^a-zA-Z0-9]/g, '_');
      const linkType = zone.linkType || 'url';

      let handlerFn = '';
      let comment = '';
      if (linkType === 'url') {
        comment = 'LINK';
        handlerFn = `openExternalLinkFull(e, ${varName});`;
      } else if (linkType === 'pdf') {
        comment = 'PDF';
        handlerFn = `openExternalPDF(e, ${varName});`;
      } else if (linkType === 'mod') {
        comment = 'MOD-INT';
        const jobId = zone.jobId || globalJobId;
        handlerFn = `openMod("${jobId}");`;
      }

      return `        //${comment}
        $('#${zone.id}')[0].addEventListener("click", function (e) {
            ${handlerFn}
        }, false);`;
    })
    .join('\n');

  return `$(document).ready(function () {

    //External Link
    function openExternalLinkFull(e, clickTag) {
        if (typeof appHost !== 'undefined') {
            appHost.openExternalLinkFull(clickTag);
        } else {
            window.open(clickTag);
        }
    }

    //External PDF
    function openExternalPDF(e, pdfUrl) {
        if (typeof appHost !== 'undefined') {
            appHost.requestPDFView(pdfUrl);
        } else {
            window.open(pdfUrl);
        }
    }

    //MODAL-INT Open
    function openMod(jobId) {
        if (typeof appHost !== 'undefined') {
            appHost.requestModalAdView("mod/index.html");
        } else {
            window.open("https://patientpointdemo.com/banner_review/IADS-" + jobId + "/index.html");
        }
    }

${clickTagVars}

    function assignClickHandlers() {
${clickHandlers}

    }

    assignClickHandlers();

});`;
}

/**
 * Generate main.css
 */
export function generateCSS(config) {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body { overflow: hidden; }
#container { position: absolute; width: ${config.dimensions.width}px; height: ${config.dimensions.height}px; overflow: hidden; background: white;}
.background { position: absolute; top: 0; left: 0; }
#clickTag1 { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; }
[id^="frame"] { position: absolute; top: 0; left: 0; visibility: hidden; opacity: 0; }
#outerMostDiv { position: absolute; bottom: 0; left: 0; width: 100%; height: 540px; background: white; overflow: hidden; }
#innerMostDiv { position: absolute; width: 100%; overflow-y: auto; }`;
}

/**
 * Generate scroller.css for ISI templates
 */
export function generateScrollerCSS(config) {
  const isiHeight = config.isiHeight || 540;
  const isiTop = config.isiTop || config.dimensions.height - isiHeight;
  const isiWidth = config.isiWidth || config.dimensions.width;
  const isiLeft = config.isiLeft || 0;
  const isiBackgroundColor = config.isiBackgroundColor || '#ffffff';
  const scrollerColor = config.scrollerColor || '#798280';
  const scrollerWidth = config.scrollerWidth || 12;
  const scrollerHeight = config.scrollerHeight || 35;
  const scrollerBorderRadius = config.scrollerBorderRadius || 50;
  const scrollerTrackColor = config.scrollerTrackColor || '#b8bebc';
  const scrollerTrackWidth = config.scrollerTrackWidth || 12;

  return `/* Scroller CSS for ISI */
#outerMostDiv {
    position: absolute;
    height: ${isiHeight}px;
    width: ${isiWidth}px;
    left: ${isiLeft}px;
    top: ${isiTop}px;
    background-color: ${isiBackgroundColor};
    overflow: hidden;
}

#innerMostDiv {
    overflow-x: hidden;
    position: absolute;
    height: inherit;
    top: 0;
    left: 0;
    width: ${isiWidth - scrollerTrackWidth - 8}px;
}

#isi-content-wrapper {
    position: relative;
}

.scroller {
    position: absolute;
    cursor: pointer;
    width: ${scrollerWidth}px;
    height: ${scrollerHeight}px;
    top: 0;
    margin-top: 0px;
    right: 0px;
    background: ${scrollerColor};
    border-radius: ${scrollerBorderRadius}px;
    transition: top 0.08s;
}

.scrollerbg {
    width: ${scrollerWidth + 8}px;
    height: ${scrollerHeight}px;
    background: transparent;
}

.isiLineWithArrows {
    background: ${isiBackgroundColor};
    border-radius: 0;
    top: 10%;
    right: 0px;
    height: 95%;
    width: ${scrollerTrackWidth}px;
    cursor: pointer;
}

.isiLineNoArrows {
    background: ${scrollerTrackColor};
    border-radius: ${scrollerBorderRadius}px;
    top: 0px;
    right: 0px;
    height: 100%;
    width: ${scrollerTrackWidth}px;
    cursor: pointer;
}

#isi-controls {
    right: 7px;
    height: ${isiHeight - 30}px;
    width: ${scrollerTrackWidth}px;
    position: absolute;
    top: 10px;
    z-index: 999;
}

::-webkit-scrollbar {
    -webkit-appearance: none;
}`;
}

/**
 * Generate buttons.css for video templates
 */
export function generateButtonsCSS(config) {
  const buttonCount = config.buttonCount || 0;
  if (buttonCount === 0) return '';

  let css = `/* Button Styles */
.cta-button {
  background-color: #2e8e95;
  height: auto;
  border: none;
  display: block;
  border-radius: 16px;
  color: #fff;
  font-family: Roboto, sans-serif;
  font-size: 30px;
  text-align: center;
  top: auto;
  width: 98%;
  padding: 2px;
  margin: 6px;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.cta-button:hover {
    opacity: 0.9;
    transform: scale(1.02);
}

`;
  // Generate CSS for each button
  for (let i = 0; i < buttonCount; i++) {
    const btn = config.buttons[i] || {};
    css += `#ctaButton${i + 1} {
    display: block;
    background-color: ${btn.bgColor || '#2e8e95'};
    color: ${btn.textColor || '#ffffff'};
    border: 2px solid ${btn.borderColor || btn.bgColor || 'none'};
    border-radius: ${btn.borderRadius || 16}px;
    width: ${`${btn.width}px` || '98%'};
    height: ${`${btn.height}px` || 'auto'};
    top: ${btn.top || 100}px;
    left: ${btn.left || 50}px;
    font-size: ${Math.floor((btn.height || 50) * 0.35)}px;
    font-family: Roboto, sans-serif;
    text-align: center;
    padding: 2px;
    margin: 6px;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
}

`;
  }
  return css;
}

/**
 * Generate clicks.css for click zones
 */
export function generateClicksCSS(config) {
  const clickZones = config.clickZones || [];
  if (clickZones.length === 0) return '';

  let css = `/* Click Zone Styles */
.click-zone {
    position: absolute;
    cursor: pointer;
    z-index: 10;
}

`;
  // Generate CSS for each zone
  clickZones.forEach((zone) => {
    css += `#${zone.id} {
    top: ${zone.top}px;
    left: ${zone.left}px;
    width: ${zone.width}px;
    height: ${zone.height}px;
}

`;
  });
  return css;
}

/**
 * Generate main.js for ISI scroller functionality
 */
export function generateMainJS(config) {
  const scrollStep = config.scrollStep || 5;
  const autoScrollSpeed = config.autoScrollSpeed || 80;
  return `var _loadedImages = 0,
    _tl = new TimelineMax({delay: 0}),
    _isiText = document.getElementById('innerMostDiv'),
    _container = document.getElementById('outerMostDiv'),
    _isiControls = document.getElementById('isi-controls'),
    _scrollerBeingDragged = false,
    _scroller, _scrollerbg, _scrollerline, _arrowUp, _arrowDown,
    _normalizedPosition,
    _topPosition,
    _contentPosition = 0,
    _percentY,
    autoScroll,
    autoScrollSpeed = ${autoScrollSpeed},
    scrollStep = ${scrollStep},
    _textScrollHeight,
    intervalRewind;

function init2() {
    createScroll(false, true);
}

function createScroll(hasArrows, hasScroller) {
    hasArrows = typeof hasArrows !== 'undefined' ? hasArrows : true;
    hasScroller = typeof hasScroller !== 'undefined' ? hasScroller : true;

    if (hasArrows) {
        _arrowUp = document.createElement("div");
        _arrowUp.id = 'arrowUp';
        _arrowUp.className = 'retina';
        _isiControls.appendChild(_arrowUp);
    }

    if (hasScroller) {
        _scrollerline = document.createElement("div");
        _scrollerline.className = hasArrows ? 'isiLineWithArrows' : 'isiLineNoArrows';
        _isiControls.appendChild(_scrollerline);

        _scroller = document.createElement("div");
        _scrollerbg = document.createElement("div");
        _scroller.className = 'scroller';
        _scrollerbg.className = 'scrollerbg';
        _scrollerline.appendChild(_scroller);
        _scrollerline.appendChild(_scrollerbg);
    }

    if (hasArrows) {
        _arrowDown = document.createElement("div");
        _arrowDown.id = 'arrowDown';
        _arrowDown.className = 'retina';
        _isiControls.appendChild(_arrowDown);
    }

    if (hasScroller) {
        _isiText.addEventListener('scroll', moveScroller);
        _scroller.addEventListener('mousedown', startDrag);
        _scrollerbg.addEventListener('mousedown', startDrag);
        _scrollerline.addEventListener('click', seekTo);
        window.addEventListener('mousemove', scrollBarScroll);
    }

    if (hasArrows) {
        _arrowUp.addEventListener('mousedown', scrollUp);
        _arrowDown.addEventListener('mousedown', scrollDown);
        _arrowUp.addEventListener('mouseup', scrollStop);
        _arrowDown.addEventListener('mouseup', scrollStop);
    }

    _isiText.addEventListener('wheel', isiWheel);
    window.addEventListener('mouseup', stopDrag);
}

function seekTo(evt) {
    var normalPosition = (evt.pageY - _isiControls.offsetParent.offsetTop - _scrollerline.offsetTop) / _scrollerline.clientHeight;
    _textScrollHeight = _isiText.scrollHeight - _container.offsetHeight;
    _isiText.scrollTop = normalPosition * _textScrollHeight;
    clearIntervalFunct();
}

function startDrag(evt) {
    _normalizedPosition = evt.pageY - _scrollerline.scrollTop;
    _contentPosition = _isiText.scrollTop;
    _scrollerBeingDragged = true;
    clearIntervalFunct();
}

function stopDrag(evt) {
    if (typeof buttonPress != 'undefined' && buttonPress) clearInterval(buttonPress);
    _scrollerBeingDragged = false;
}

function scrollBarScroll(evt) {
    evt.preventDefault();
    if (_scrollerBeingDragged === true) {
        var mouseDifferential = evt.pageY - _normalizedPosition;
        var scrollEquivalent = mouseDifferential * (_isiText.scrollHeight / _scrollerline.clientHeight);
        _isiText.scrollTop = _contentPosition + scrollEquivalent;
    }
}

function moveScroller(evt) {
    evt.preventDefault();
    _textScrollHeight = _isiText.scrollHeight - _container.offsetHeight;
    var remainOffsetHeight = _textScrollHeight - _isiText.scrollTop;
    var percentHeight = 1 - remainOffsetHeight / _textScrollHeight;
    _scroller.style.top = Math.abs((_scrollerline.offsetHeight - _scroller.offsetHeight) * percentHeight) + 'px';
    _scrollerbg.style.top = Math.abs((_scrollerline.offsetHeight - _scrollerbg.offsetHeight) * percentHeight) + 'px';
}

function isiWheel(evt) {
    clearIntervalFunct();
}

function scrollUp() {
    clearIntervalFunct();
    buttonPress = setInterval(function() { _isiText.scrollTop -= scrollStep; }, 100);
}

function scrollDown() {
    clearIntervalFunct();
    buttonPress = setInterval(function() { _isiText.scrollTop += scrollStep; }, 100);
}

function scrollStop() {
    _tl.kill(null, _isiText);
}

function clearIntervalFunct() {
    _tl.kill(null, _isiText);
}

$(document).ready(function() {
    init2();
});`;
}
