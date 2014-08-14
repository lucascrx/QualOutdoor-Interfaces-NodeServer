var fs =require('fs');
var http = require('http');
var util = require('util');
var formidable = require('formidable');
var mysql = require('mysql');

//creation d'un serveur à partir d'une fonction prenant comme parametres la requete et la réponse
server = http.createServer(function(req,res){
	//si la requete est de type post et est destinée à l'url d'upload
	if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
		//test de detection de la donnée uploadée
		req.on('data',function(chunk){
		console.log("POST DATA DETECTED"+"\n");
		});
		//creation d'un handler de fichiers uploadés : on le crée avec le chemin de stockage
		var form = new formidable.IncomingForm({ uploadDir: __dirname + '/uploaded' });
		console.log("POST FORMULAR INPUT : "+__dirname+"\n");
		//initialisation de 2 tableaux recupérant respectivement des champs et les fichiers 			transmis
		var fields = [];
		var files = [];
		//initialisation des timestamp
		var receptionTime;		
		var endInsertionTime;
		var startTreeTranslationTime;
		var endTreeTranslationTime;

		//A la reception d'un fichier	
		form.on('file',function(field,file){
			startTime = new Date();
			console.log("FILE RECIEVED AT TIME :"+ startTime +"\n");
			files.push([field, file]);//on remplit le tableau prévu à cet effet
			fs.rename(file.path, form.uploadDir + "/" + file.name);//on renome le fichier avec son nom original
			console.log("FILE NAME : "+file.name+"\n");
			console.log("STORED INTO DIR :"+form.uploadDir+"\n\n");
		})
		
		//A la reception d'un champs
		.on('field',function(field,value){
			console.log("FIELD RECIEVED"+"\n");
			fields.push([field, value]);//on remplit le tableau prévu à cet effet
			console.log("FIELD NAME :"+value+"\n");
		})
		
		//A la fin de la requete
		.on('end',function(){
			//On écrit une réponse qui détaille toutes les données reçues
			console.log('upload done'+"\n");
			res.writeHead(200,{'content-type':'text/plain'});
			res.write('recieved fields:\n\n'+util.inspect(fields));
			res.write('\n\n');
			res.end('recieved files: \n\n'+util.inspect(files));

			//ECRITURE DANS LA BASE DE DONNEE MYSQL
	
			//connexion à la base de donnée:
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
	
			
			//écriture dans la bdd des fichiers reçus 									
			var i;
			for(i=0;i<files.length;i++){//pour tous les fichiers du tableau
				var shortName = (files[i])[1].name //nom simple du fichier
				var path = form.uploadDir + "/" +(files[i])[1].name//on recupere leur chemin
				console.log("preparing file for insertion \n");	
				//préparation des fichiers pour les rendres compatibles csv:
				fs.readFile(path, 'utf-8', function (err,data){
					if(err){
						return console.log(err);
					}
					
					var result_temp = data.replace(/\#(.+)#/g, '');
					var result = result_temp.split("$").join("///;");
					
					fs.writeFile(path, result, 'utf-8', function (err){
						if(err){
							return console.log(err);
						}
					});
				});
	
				//préparation de la requete d'insertion du fichier dans la bdd
				
				//creation de la table temporaire qui parse le csv:
				
				var createQuery = "create table table_upload_temp_"+shortName+" (LINE INT NOT NULL AUTO_INCREMENT PRIMARY KEY ,LVL INT NOT NULL, REFERENCE BIGINT NOT NULL, LAT REAl, LNG REAL, MEAS_DATA VARCHAR(100) ) ENGINE=MyISAM "
				
				connection.query(createQuery, function(err,result){
					if(err){
						return console.log(err);
					}
				});
				

				//chargement du csv dans la table
				var strQuery = "LOAD DATA LOCAL INFILE '"+path+"' INTO TABLE table_upload_temp_"+shortName+" FIELDS TERMINATED BY '/' LINES TERMINATED BY ';' (LVL , REFERENCE , LAT , LNG , MEAS_DATA)";
				
				//execution de la requete
				connection.query(strQuery, function(err,rows){
					if(err){
						return console.log(err)
					}
					else{
						endInsertionTime = new Date();
						console.log("file correcly loaded at" + endInsertionTime + "\n");	

						//appel de la procedure SQL
						var callQuery = "CALL proc_tree('table_upload_temp_"+shortName+"')";
						startTreeTranslationTime = new Date();
						console.log("beginning tree translation at" + startTreeTranslationTime+"\n");
						connection.query(callQuery, function(err,rows){
							if(err){
								return console.log(err)
							}else{
								endTreeTranslationTime = new Date();
								console.log("ending tree translation at" + endTreeTranslationTime+"\n");
																			   									console.log("tree created from file \n");
								//on clot la connection
								connection.end();
								console.log("Connection with data base over \n");

							}
						}); 
					

				

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
