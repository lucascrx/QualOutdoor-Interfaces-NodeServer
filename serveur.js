var fs =require('fs');
var http = require('http');
var util = require('util');
var formidable = require('formidable');
var mysql = require('mysql');
var unzip = require('unzip');

//Server creation
server = http.createServer(function(req,res){
	//checking whether incomming request is an http post request destinated to the upload URL
	if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
		
		//Uploaded File handler creation : file saving path is specified here
		var form = new formidable.IncomingForm({ uploadDir: __dirname + '/uploaded' });
		var filesNames = [];
		//initialisation des timestamp
		var startTime;		
		var storageName;
		var randomNumber;
		var stamp;
		//bornes de l'intervalle de génération du nombre aléatoire
		var borneSup = 9999;
		var borneInf = 1000;

		//When file is detected on incomming formular	
		form.on('file',function(field,file){
			//Creation of a file signature : in order to preserve file unicity
			startTime = new Date().getTime();
			randomNumber = Math.floor(Math.random() * borneSup) + borneInf;
			stamp = /*startTime + "_" +*/ randomNumber;
			storageName = stamp+"_"+file.name ;
			//File is renamed with a unique name
			fs.rename(file.path, form.uploadDir + "/" + storageName);
			//its name is added to the field list to load into data base
			filesNames.push(storageName);
		})
		
		//When field is detected on incomming formular
		.on('field',function(field,value){
			//Now nothing to do
		})
		
		//When request ends
		.on('end',function(){
			//Writing response to client
			console.log('upload done'+"\n");
			res.writeHead(200,{'content-type':'text/plain'});
			res.end('recieved files: \n\n'+util.inspect(filesNames));
				
			var i;
			for(i=0;i<filesNames.length;i++){
				//for every recieved file
				var shortName = filesNames[i] 
				console.log("FILE : "+ shortName);
				var path = form.uploadDir + "/" +shortName
				console.log("unzipping file");
				var extractName = "DIR_"+shortName;
				var extractPath = form.uploadDir + "/"+extractName;
				//unzipping them
				var stream = fs.createReadStream(path).pipe(unzip.Extract({ path:extractPath}));
				var error_occured = false;
				stream.on('error',function(err){
					console.log("error while unzipping");
					error_occured = true;
				}); 
				//when unzipping is correctly done:
				stream.on('close',function(){
					if(!error_occured){
						//listing files into extracted archive
						var filesIntoZip = fs.readdirSync(form.uploadDir + "/"+extractName+"/");
						var loopSize = filesIntoZip.length;
						var iterator = 0;
						//opening db connection
						var connection = mysql.createConnection(
							{	
							host : "localhost" ,
							user : "ftp",
							password : "passftp",
							database : 'qualoutdoor_db',
							}
						);
						connection.connect();
							
						console.log("connection enabled with data base \n");
							
						//looping on every file to load	
						(function loop(i,max){
							
								var tableName = extractName + "_" + filesIntoZip[i];
								var pathToFile = form.uploadDir + "/"+extractName+"/"+filesIntoZip[i];
							
								console.log("treatment of file " + (i+1) +" over "+ max +" started \n");	
								
								//preparation of pending files : changing special characters
								
								fs.readFile(pathToFile, 'utf-8', function (err,data){
									if(err){
										return console.log(err);
									}
									var result_temp = data.replace(/\#(.+)#/g, '');
									var result = result_temp.split("$").join("///;");
								
									fs.writeFile(pathToFile, result, 'utf-8', function (err){
										if(err){
											return console.log(err);
										}
									});
								});
								
								//loading file into a new table:
								
								var createQuery = "create table temp_"+tableName+" (LINE INT NOT NULL AUTO_INCREMENT PRIMARY KEY ,LVL INT NOT NULL, REFERENCE BIGINT NOT NULL, LAT REAl, LNG REAL, MEAS_DATA VARCHAR(100) ) ENGINE=MyISAM "
								
								connection.query(createQuery, function(err,result){
									if(err){
										return console.log(err);
									}
								});
					

								var strQuery = "LOAD DATA LOCAL INFILE '"+pathToFile+"' INTO TABLE temp_"+tableName+" FIELDS TERMINATED BY '/' LINES TERMINATED BY ';' (LVL , REFERENCE , LAT , LNG , MEAS_DATA)";
								
								connection.query(strQuery, function(err,rows){
									if(err){
										return console.log(err)
									}
									else{//when file loading is done, tree must be translated
										var callQuery = "CALL proc_tree('temp_"+tableName+"')";
										connection.query(callQuery, function(err,rows){
											if(err){
												return console.log(err)
											}else{
												console.log("tree generated from file " + (i+1) +" over "+ max +" \n");
												//then applying loop on next file
												if(i+1 != max){
													//deleting file into extracted zip folder
													fs.unlink(pathToFile,function (err){
															if(err){
																return console.log(err);
															}
													});
													
													//calling loop for the next file
													loop(i+1,max);
												}else{//when every file of the folder is sent
												
													//deleting folder and archive:
													fs.unlink(path,function (err){
															if(err){
																return console.log(err);
															}
													});
													
													//deleting the last file of extracted zip folder
													fs.unlink(pathToFile,function (err){
															if(err){
																return console.log(err);
															}else{
																//deleting empty folder
																fs.rmdirSync(extractPath);
														}
													});
													
													
														
													
													//ending data base connection
													console.log("Connection with data base over \n");
													connection.end();
													
												 
												}
											}
										});
									}	
								});	
						}(iterator,loopSize));
					}
				});

			}
			
		})
		form.parse(req);
		

	//si la requete est de type get pour la meme URL:on affiche un formulaire à remplir pour préparer
	//l'envoi d'une requete de type post
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

	}else{//si une autre url est demandée 
		res.writeHead(404, {'content-type':'text/plain'});
		res.end('404')
	}
});
server.listen(8080);//on met en route le serveur
