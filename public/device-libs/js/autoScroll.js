var my_time;
setTimeout(function () {
    pageScroll();
    console.log("ISI starts scrolling");
    $("#innerMostDiv").mouseup(function () {
        clearTimeout(my_time);
    }).mouseout(function () {
        //Nothing
    });
}, 1000); //delay
function pageScroll() {
    var objDiv = document.getElementById('innerMostDiv');
    objDiv.scrollTop = objDiv.scrollTop + 1;
    my_time = setTimeout('pageScroll()', 30); // scroll speed the higher the slower
}

// paste below in index.html
// <!-- <script type="text/javascript" src="js/autoScroll.js"></script> -->