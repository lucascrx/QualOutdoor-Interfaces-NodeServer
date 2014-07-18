var formidable = require('formidable');
var http = require('http');
var util = require('util');
var fs =require('fs');

server = http.createServer(function(req,res){

	if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
	
		req.on('data',function(chunk){
		console.log("ok");
		});

		var form = new formidable.IncomingForm({ uploadDir: __dirname + '/uploaded' });
		console.log(__dirname);
		var fields = [];
		var files = [];
	
		form.on('file',function(field,file){
			console.log("file");
			console.log(field, file);
			files.push([field, file]);
			fs.rename(file.path, form.uploadDir + "/" + file.name);
		})

		.on('field',function(field,value){
			console.log("field");
			console.log(field, value);
			fields.push([field, value]);
		})

		.on('end',function(){
			console.log('upload done');
			res.writeHead(200,{'content-type':'text/plain'});
			res.write('recieved fields:\n\n'+util.inspect(fields));
			res.write('\n\n');
			res.end('recieved files: \n\n'+util.inspect(files));
		})
		form.parse(req);
	}else if  (req.url == '/upload' && req.method.toLowerCase() == 'get') {
		res.writeHead(200, {'content-type':'text/html'});
		res.end(
		'<form method="post" action="/upload" enctype="multipart/form-data"><br>'+
		'<label for="nom">name :</label><br>'+
		'<input type="text" name="name" id="name"/><br>'+
		'<label for="pass">password :</label><br>'+
		'<input type="text" name="pass" id="idpass"/><br>'+
		'<label for="file">file to upload :</label><br>'+
		'<input type="file" name="mon_fichier" id="idmon_fichier" multiple="multiple" /><br>'+
		'<input type="submit" value="OK" /><br>'+
		'</form>'
		);

	}else{
		res.writeHead(404, {'content-type':'text/plain'});
		res.end('404')
	}
});
server.listen(8080);
