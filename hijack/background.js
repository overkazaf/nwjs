chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        return {
            //cancel: details.url.indexOf("://mail.trueway.com.cn/") != -1
        };
    }, {
        urls: ["<all_urls>"]
    }, ["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
    	console.log('headers');
    	console.log(details.requestHeaders);
        return {
            //cancel: details.url.indexOf("://mail.trueway.com.cn/") != -1
        };
    }, {
        urls: ["<all_urls>"]
    }, ["blocking"]);
