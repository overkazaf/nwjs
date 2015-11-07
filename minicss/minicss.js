var CleanCSS = require('clean-css'),
	fs = require('fs');


var args = process.argv.slice(2);

if (args.length !== 2) {
	console.error('Usage:node minicss.js src.css dist.css');
} else {
	var src = args[0],
		dest = args[1];

	if (isCSSFile(src)) {
		if (!isCSSFile(dest)) {
			dest = dest.chatAt(dest.length-1) === '/' ? dest : dest + '/';
			dest = dest + src.substring(src.lastIndexOf('/')+1);
		}
		doCompress(src, dest);
	} else {

	}
}

function isCSSFile (filename) {
	if (filename) {
		filename = filename.toString();
		return filename.lastIndexOf('.css') === filename.length - 4;
	}

	return false;
}

/**
 * [doCompress Compress one single css file into a compressed one]
 * @param  {[type]} src  [source file]
 * @param  {[type]} dest [destination file]
 * @return {[type]}      [description]
 */
function doCompress (src, dest) {
	fs.readFile(src, function (err, data) {
		if (err) {
			throw err;
		}

		try {
			var compressed = new CleanCSS().minify(data).styles;

			fs.writeFile(dest, compressed, function (err, css) {
				if (err) {
					throw err;
				}

				console.log(src + ' has been written to ' + dest);

				var exec = require('child_process').exec,
				ssh = exec('ssh root@50.117.96.188');

				ssh.stdout.on('data', function (data) {
					console.log('标准输出：' + data);
				});

				ssh.on('exit', function (code) {
					console.log('子进程已关闭，代码：' + code);
				}); 
			});
		} catch (e) {}
		
	});
}