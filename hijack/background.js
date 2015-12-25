chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
    	console.log(details);
        return {
            cancel: details.url.indexOf("://mail.trueway.com.cn/") != -1
        };
    }, {
        urls: ["<all_urls>"]
    }, ["blocking"]);
