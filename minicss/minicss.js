var CleanCSS = require('clean-css'),
	fs = require('fs');


var args = process.argv.slice(2);

if (args.length !== 2) {
	console.error('Usage node minicss.js src.css dist.css');
} else {
	var src = args[0],
		dist = args[1];

	fs.readFile(src, function (err, data) {
		if (err) {
			throw err;
		}

		var compressed = new CleanCSS().minify(data).styles;
		
		fs.writeFile(dist, compressed, function (err, css) {
			if (err) {
				throw err;
			}

			console.log(src + ' has been written to ' + dist);
		});
	});

}