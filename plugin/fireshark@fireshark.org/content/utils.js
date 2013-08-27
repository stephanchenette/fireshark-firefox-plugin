/*
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

	
var EXPORTED_SYMBOLS = ["getChannelWindow", "GetWindowForRequest", "GetRequestWebProgress", "getRandomInt", "SaveAllDOMs", "getEscapedFileContents", "getFileContents", "SaveSource", "SaveScreenShot", "saveFile" , "RemoveFile", "makeURI", "saveDOMToFile", "saveFileToProfileDir", "getSha1DigestFromUTF8String", "createSha1Directory"];

Components.utils.import("resource://content/logmanager.js");

function makeURI(aURL, aOriginCharset, aBaseURI) {

  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);

  return ioService.newURI(aURL, aOriginCharset, aBaseURI);
}

function getFileContents(filepath, arr) {

	try {
		// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
		var file = Components.classes['@mozilla.org/file/local;1']
			.createInstance(Components.interfaces.nsILocalFile);

		file.initWithPath(filepath);
		if(!file.exists() || !file.isFile()) {
			return;
		}

		// open an input stream from file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);

		istream.init(file, 0x01, 0444, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);

		// read lines into array
		var line = {}, hasmore;

		do {

			hasmore = istream.readLine(line);

			arr.push(line.value);

			//LogManager.logToConsole(line.value);

		} while (hasmore);

		//LogManager.logToConsole("Fireshark:fileLinesToArray() # of URLs: " + arr.length);

		istream.close();

	} catch(e) {

		LogManager.logToConsole(e);
	}
}

function getEscapedFileContents(filepath, arr) {

	try {
		// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
		var file = Components.classes['@mozilla.org/file/local;1']
			.createInstance(Components.interfaces.nsILocalFile);

		file.initWithPath(filepath);

		// open an input stream from file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);

		istream.init(file, 0x01, 0444, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);

		// read lines into array
		var line = {}, hasmore;

		do {

			hasmore = istream.readLine(line);
			
			line.value = line.value.replace(/&/g, "&amp;");
		    line.value = line.value.replace(/</g, "&lt;");
		    line.value = line.value.replace(/>/g, "&gt;");
		    line.value = line.value.replace(/"/g, "&quot;");

			arr.push(line.value);

			//LogManager.logToConsole(line.value);

		} while (hasmore);

		//LogManager.logToConsole("Fireshark:fileLinesToArray() # of URLs: " + arr.length);

		istream.close();

	} catch(e) {

		LogManager.logToConsole(e);
	}
}

function getChannelWindow(/**nsIChannel*/ channel) /**nsIDOMWindow*/
{
	var callbacks = [];
	if (channel.notificationCallbacks)
		callbacks.push(channel.notificationCallbacks);
	if (channel.loadGroup && channel.loadGroup.notificationCallbacks)
		callbacks.push(channel.loadGroup.notificationCallbacks);

	for each (var callback in callbacks)
	{
		try {
			// For Gecko 1.9.1
			return callback.getInterface(Components.interfaces.nsILoadContext).associatedWindow;
		} catch(e) {}

		try {
			// For Gecko 1.9.0
			return callback.getInterface(Components.interfaces.nsIDOMWindow);
		} catch(e) {}
	}

	return null;
}

function GetWindowForRequest(request)
{
   LogManager.logToConsole("in GetWindowForRequest\n");

   var webProgress = GetRequestWebProgress(request);
   try {

       if (webProgress) {
           //LogManager.logToConsole("leaving value GetWindowForRequest\n");
           return webProgress.DOMWindow;
       }
   }
   catch (e) {

	LogManager.logToConsole("GetWindowForRequest exception: " + e);
   }

   //LogManager.logToConsole("leaving null GetWindowForRequest\n");
   return null;
};

// https://developer.mozilla.org/en/Exception_logging_in_JavaScript
function GetRequestWebProgress(request)
{
    //LogManager.logToConsole("in GetRequestWebProgress\n");
    try
    {
        if (request.notificationCallbacks)
            return request.notificationCallbacks.getInterface(Components.interfaces.nsIWebProgress);
   
    } catch (e) {
        //LogManager.logToConsole("GetRequestWebProgress exception: " + e);
    }

    try
    {
       if (request.loadGroup && request.loadGroup.groupObserver)
           return request.loadGroup.groupObserver.QueryInterface(Components.interfaces.nsIWebProgress);
    } 
    catch (e) {
         //LogManager.logToConsole("GetRequestWebProgress exception: " + e);
    }

   return null;
};

function getRandomInt(min, max)
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createDirectory(path, str) 
{
	try {
	
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		
		dir1 = str.slice(0, 3);
		file.append(dir1);
		
		dir2 = str.slice(3, 6);
		file.append(dir2);
		
		dir3 = str.slice(6, 9);
		file.append(dir3);
		
		if( !file.exists() || !file.isDirectory() ) {   // if it doesn't exist, create  
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);  
		}  
		
	} catch(e) {
		LogManager.logToConsole("createDirectory caught an exception " + e.name + ": " + e.message);
		return "";
	}
	
	return file.path;
}

// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
function createSha1Directory(path, sha1Digest) 
{
	try {
	
		LogManager.logToConsole("createSha1Directory called");
		
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(path);
		
		dir1 = sha1Digest.slice(0, 4);
		file.append(dir1);
		
		dir2 = sha1Digest.slice(4, 7);
		file.append(dir2);
		
		dir3 = sha1Digest.slice(7, 10);
		file.append(dir3);
		
		LogManager.logToConsole("createSha1Directory will create the following direcotry: " + file.path);
		
		if( !file.exists() || !file.isDirectory() ) {   // if it doesn't exist, create  
			file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);  
		}  
		
		LogManager.logToConsole("createSha1Directory has created the following direcotry: " + file.path);
		
	} catch(e) {
		LogManager.logToConsole("createSha1Directory caught an exception " + e.name + ": " + e.message);
		return "";
	}
	
	return file.path;
}

// return the two-digit hexadecimal code for a byte  
function toHexString(charCode)  
{  
	try {
		return ("0" + charCode.toString(16)).slice(-2);  
	} catch(e) {
		LogManager.logToConsole("toHexString caught an exception " + e.name + ": " + e.message);
	}
}

function getRandomString() {
	try {
	
		var S4 = function() {
		   return (((1+Math.random())*0x10000)|0).toString(16).substring(1).toLowerCase();
		};
		return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
	}
	catch(e) {
		LogManager.logToConsole("getGuid caught an exception " + e.name + ": " + e.message);
	}
	
	return "";
}

function getSha1DigestFromUTF8String(str) 
{ 
	try {
	
		LogManager.logToConsole("getSha1DigestFromUTF8String called");

		if(str == undefined) {
			return "";
		}
		
		var converter =  
			Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].  
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);  
	  
		// we use UTF-8 here, you can choose other encodings.  
		converter.charset = "UTF-8";  
		// result is an out parameter,  
		// result.value will contain the array length  
		var result = {};    
		var byteArray = converter.convertToByteArray(str, result);  
		var ch = Components.classes["@mozilla.org/security/hash;1"]  
					   .createInstance(Components.interfaces.nsICryptoHash);  
		ch.init(ch.SHA1);  
		ch.update(byteArray, byteArray.length);  
		var hash = ch.finish(false);  
		
		var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");  
		
		// s now contains your hash in hex: 
		// should be 5eb63bbbe01eeed093cb22bb8f5acdc3  
		
		return s;
		
	} catch(e) {
		LogManager.logToConsole("getSha1DigestFromUTF8String caught an exception " + e.name + ": " + e.message);
		return "";
	}
}

function getSha1DigestFromArray(byteArray) 
{ 
	try {
	
		LogManager.logToConsole("getSha1DigestFromArrayBuffer called");

		if(byteArray == undefined) {
			return "";
		}
		
/*		
		var converter =  
			Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].  
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);  
	  
		// we use UTF-8 here, you can choose other encodings.  
		converter.charset = "UTF-8";  
		// result is an out parameter,  
		// result.value will contain the array length  
		var result = {};    
		var byteArray = converter.convertToByteArray(data, result);  
		var ch = Components.classes["@mozilla.org/security/hash;1"]  
					   .createInstance(Components.interfaces.nsICryptoHash);  
		ch.init(ch.SHA1);  
		ch.update(byteArray, byteArray.length);  
		var hash = ch.finish(false);  
*/

		var ch = Components.classes["@mozilla.org/security/hash;1"]
                .createInstance(Components.interfaces.nsICryptoHash);
		 ch.init(ch.SHA1);
		 // https://developer.mozilla.org/En/XMLHttpRequest/Using_XMLHttpRequest#Handling_binary_data
		 ch.update(byteArray, byteArray.length);
		 var hash =  ch.finish(false);		
/*		
		var ch = Components.classes["@mozilla.org/security/hash;1"]
                .createInstance(Components.interfaces.nsICryptoHash);
		 ch.init(ch.SHA1);
		 // this works correctly for binary data, but takes an extremely long time
		 var byteArray = data.split('').map(function(c) { return c.charCodeAt(0); });
		 ch.update(byteArray, byteArray.length);
		 var hash =  ch.finish(false);
 */
		// convert the binary hash data to a hex string.  
		var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");  
		
		// s now contains your hash in hex: 
		// should be 5eb63bbbe01eeed093cb22bb8f5acdc3  
		
		LogManager.logToConsole("sha1: " + s);
		
		return s;
		
	} catch(e) {
		LogManager.logToConsole("getSha1Digest caught an exception " + e.name + ": " + e.message);
		return "";
	}
}

// https://developer.mozilla.org/en/nsIFile/createUnique
// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO

function saveDOMToFile(path, win)
{
	try {
	
		var doc = win.document;
		var serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
			.createInstance(Components.interfaces.nsIDOMSerializer);

		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		
		var dom = serializer.serializeToString(doc);
		
		/*
		var sha1Digest = getSha1DigestFromUTF8String(dom);
		if(sha1Digest.length != 0) {
			LogManager.logToConsole("sha1Digest: " + sha1Digest);
			var sha1Dir = createSha1Directory(path, sha1Digest);
			LogManager.logToConsole("path: " + sha1Dir);
			if(sha1Dir.length != 0) {
				file.initWithPath(sha1Dir);
				file.append(sha1Digest);
				LogManager.logToConsole("sha1 path: " + file.path);
				saveFile(file.path, dom);
			}
		}
		*/
		var randomString = getRandomString();
		if(randomString.length != 0) {
			var dir = createDirectory(path, randomString);
			if(dir.length != 0) {
				file.initWithPath(dir);
				file.append(randomString);
				saveFile(file.path, dom);
			}
		}
		
		return file.path;
	} 
	catch(e) {

		LogManager.logToConsole("saveDOMToFile caught exception " + e.name + ": " + e.message);
			
		return "";
	}
}

function RemoveFile(filename)
{
    try {
		// remove any illegal chars http://en.wikipedia.org/wiki/Filename
		filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>]/g, "");
		
		var file = Components.classes["@mozilla.org/file/directory_service;1"].  
           getService(Components.interfaces.nsIProperties).  
           get("ProfD", Components.interfaces.nsIFile);

		file.append(filename);
		
		file.remove(false);

		//LogManager.logToConsole("removing... " + file.path);

		// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
	} catch(e) {
		
		LogManager.logToConsole("RemoveFile() caught an exception " + e.name + ": " + e.message);
	}
}
function saveFileToProfileDir(filename, data)
{
	try {
	
		var file = Components.classes["@mozilla.org/file/directory_service;1"].  
           getService(Components.interfaces.nsIProperties).  
           get("ProfD", Components.interfaces.nsIFile);  

		file.append(filename);
		
		saveFile(file.path, data)
		
	} catch(e) {
	
		LogManager.logToConsole("saveFileToProfileDir caught an exception " + e.name + ": " + e.message);
	}
}

// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
function saveFile(filepath, data)
{
    try {
	
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

		file.initWithPath(filepath);
/*
		// file is nsIFile, data is a string
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);

		// use 0x02 | 0x10 to open file for appending.
		// http://mxr.mozilla.org/mozilla-central/source/nsprpub/pr/include/prio.h#569
		// http://www.mozilla.org/projects/security/components/jssec.html#privs-list
		//netscape.security.PrivilegeManager.enablePrivilege ("UniversalXPConnect");
		foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);

		// write, create, truncate
		// In a c file operation, we have no need to set file mode with or operation,
		// directly using "r" or "w" usually.

		// if you are sure there will never ever be any non-ascii text in data you can 
		// also call foStream.writeData directly

		var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);

		converter.init(foStream, "UTF-8", 0, 0);
		converter.writeString(data);
		converter.close(); // this closes foStream
*/

		var stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"].  
             createInstance(Components.interfaces.nsIFileOutputStream);  
			 
		stream.init(file, 0x04 | 0x08 | 0x20, 0666, 0); // readwrite, create, truncate  
					  
		stream.write(data, data.length);  
		if (stream instanceof Components.interfaces.nsISafeOutputStream) {  
			stream.finish();  
		} else {  
			stream.close();  
		}  

	} catch(e) {
	
		LogManager.logToConsole("saveFile caught an exception " + e.name + ": " + e.message);
	}
}


// https://developer.mozilla.org/en/XMLSerializer
// https://developer.mozilla.org/en/Parsin ... lizing_XML
// https://developer.mozilla.org/En/XMLHttpRequest
// https://developer.mozilla.org/En/NsIXMLHttpRequest
// https://developer.mozilla.org/en/NsIJSXMLHttpRequest
// https://developer.mozilla.org/en/Parsing_and_serializing_XML
// https://developer.mozilla.org/en/XUL_Tutorial/Document_Object_Model
// https://developer.mozilla.org/en/How_to_create_a_DOM_tree

// https://developer.mozilla.org/en/DOM
// https://developer.mozilla.org/en/DOM/document

function SaveAllDOMs(domInfoArray, path, win) {

	//LogManager.logToConsole("In SaveAllDOMs");

	if (!win) {

		//LogManager.logToConsole("bad window passed");
		return;
	}

	if (!win.document) {

		//LogManager.logToConsole("bad doc");
		return;
	}

	var serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
		.createInstance(Components.interfaces.nsIDOMSerializer);

	var xml = serializer.serializeToString(win.document);

	//LogManager.logToConsole("URI of document " + win.document.URL);

	// note if frame dns response is an error the uri will be something in this format:
	// about:neterror?e=dnsNotFound&u=http%3A//molo.tw/index.php&c=ISO-8859-1&d=Firefox%20can%27t%20find%20the%20server%20at%20molo.tw.
	// https://developer.mozilla.org/en/DOM/document
	var document_uri = win.document.documentURI; // note this would give the internal uri e.g. about:neterror
	var url = win.location.href; // this will give us the true uri, even if there is a dns error
	var parenturl = win.parent.location.href;

	var frame = {};

	if (win.parent == win) {

		//LogManager.logToConsole("This is a Top Window");

		var name = "PARENT";

		//LogManager.logToConsole("frame tagname " + name);

		frame.name 		= name;
		frame.url 		= url;
		frame.parenturl 	= parenturl;  

		frame.srcfile = SaveSource(url, path, win);
		
	} else {

		// https://developer.mozilla.org/en/DOM/window.frameElement
		var el = win.frameElement;

		if (el != null) {

			var name = el.tagName;

			//LogManager.logToConsole("frame tagname " + name);

			frame.name 		= name;
			frame.url 		= url;
			frame.parenturl 	= parenturl;

			frame.srcfile = SaveSource(url, path, win);
		}
	}

    frame.filepath = saveDOMToFile(path, win);
	frame.childdoms = new Array();

	domInfoArray.push(frame);

	if (win.frames.length > 0) {
	
		//LogManager.logToConsole("number of frames " + win.frames.length);

		for (var i = 0; i < win.frames.length; i++) {

			SaveAllDOMs(frame.childdoms, path, win.frames[i]);
		}
	}
}

// http://forums.mozillazine.org/viewtopic.php?f=19&t=419963&p=6575745
// https://developer.mozilla.org/en/NsITraceableChannel

function getSha1PathFromURL(url, path, win)
{
	try {
	
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		
		LogManager.logToConsole("xmlhttprequest being made");
		var LoadFlags = Components.interfaces.nsIRequest;
        var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]  
                    .createInstance(Components.interfaces.nsIXMLHttpRequest); 
		xhr.open("GET", url, false); // synchronous request
		// https://developer.mozilla.org/En/NsIXMLHttpRequest
		// this will allow us to receive all content types even binary
		// http://www.codingforums.com/showthread.php?t=141041
		//xhr.overrideMimeType("text/plain; charset=x-user-defined");
		xhr.responseType = "arraybuffer";
        xhr.channel.loadFlags = LoadFlags.LOAD_FROM_CACHE | LoadFlags.VALIDATE_NEVER;
		
		xhr.send(null);
		
		// https://developer.mozilla.org/En/XMLHttpRequest/Using_XMLHttpRequest#Handling_binary_data
		// https://developer.mozilla.org/en/Code_snippets/Downloading_Files
		var arraybuffer = xhr.response; 
		//var response = xhr.responseText;
		
		if (arraybuffer) {
		//if(response) {
			
			/*
			var converter =  
			Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].  
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);  
	  
			// we use UTF-8 here, you can choose other encodings.  
			converter.charset = "UTF-8";  
			// result is an out parameter,  
			// result.value will contain the array length  
			var result = {};    
			var byteArray = converter.convertToByteArray(response, result); 
			*/
				
			// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/slice
			var arr = Array.slice(Uint8Array(arraybuffer)); 
			 
			if(arr) {
				
				var sha1Digest = getSha1DigestFromArray(arr);
				if(sha1Digest.length != 0) {
					LogManager.logToConsole("real sha1: " + sha1Digest);
					var sha1Dir = createSha1Directory(path, sha1Digest);
					if(sha1Dir.length != 0) {
						file.initWithPath(sha1Dir);
						file.append(sha1Digest);
					}
				}
				
			} else {
				LogManager.logToConsole("arr is null");
			}
			
		} else {
			LogManager.logToConsole("arraybuffer is null");
		}
		
	} catch(e) {
		LogManager.logToConsole("converting postdata to stream caught an exception " + e.name + ": " + e.message);
	}
	
    return file.path;
}

// experimental
function saveSource(url, path) {

	try {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService);

		LogManager.logToConsole("here 1");
		
		var uri = ioService.newURI(url, null, null);
		LogManager.logToConsole("here 2");

		var channel = ioService.newChannelFromURI(uri);
		LogManager.logToConsole("here 3");

		// read from the cache
		channel.loadFlags = Components.interfaces.nsIRequest.LOAD_FROM_CACHE;
		LogManager.logToConsole("here 4");
	
		var stream = channel.open();
		LogManager.logToConsole("here 5");

		var binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"].
			createInstance(Components.interfaces.nsIBinaryInputStream);
		LogManager.logToConsole("here 6");
		binaryInputStream.setInputStream(stream);
		LogManager.logToConsole("here 7");
		
		// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
		var bytes = binaryInputStream.readBytes(binaryInputStream.available());
		LogManager.logToConsole("here 8");
		
		var converter =  
		Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].  
			createInstance(Components.interfaces.nsIScriptableUnicodeConverter);  
  
		LogManager.logToConsole("here 9");
  
		// we use UTF-8 here, you can choose other encodings.  
		converter.charset = "UTF-8";  
		// result is an out parameter,  
		// result.value will contain the array length  
		var result = {};    
		var byteArray = converter.convertToByteArray(bytes, result); 
		LogManager.logToConsole("here 10");	
		
		var arr = Array.slice(byteArray);
		LogManager.logToConsole("here 11");
		
		if(arr) {
				
			var sha1Digest = getSha1DigestFromArray(arr);
			LogManager.logToConsole("test sha1: " + sha1Digest);
		} else {
			LogManager.logToConsole("arr is null");
		}
			
		
	} catch(e) {
		LogManager.logToConsole("saveSource caught an exception " + e.name + ": " + e.message);
	}
}

function SaveSource(url, path, win)
{
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	
	try {
		
		//saveSource(url, path);
		
		/*
		LogManager.logToConsole("xmlhttprequest being made");
		var LoadFlags = Components.interfaces.nsIRequest;
        var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]  
                    .createInstance(Components.interfaces.nsIXMLHttpRequest); 
		xhr.open("GET", url, false); // synchronous request
		// https://developer.mozilla.org/En/NsIXMLHttpRequest
		// this will allow us to receive all content types even binary
		// http://www.codingforums.com/showthread.php?t=141041
		xhr.overrideMimeType("text/plain; charset=x-user-defined");
		//xhr.responseType = "arraybuffer";
        xhr.channel.loadFlags = LoadFlags.LOAD_FROM_CACHE | LoadFlags.VALIDATE_NEVER;
		
		xhr.send(null);
		
		// https://developer.mozilla.org/En/XMLHttpRequest/Using_XMLHttpRequest#Handling_binary_data
		// https://developer.mozilla.org/en/Code_snippets/Downloading_Files
		//var arraybuffer = xhr.response; 
		var response = xhr.responseText;
		*/
		/*
		if(response) {
			var filePath = getSha1PathFromURL(url, path, win);
			if(filePath != "") {
				saveFile(filePath, response);
			}
			
		} else {
			LogManager.logToConsole("response is null");
		}
		*/
		

	
		var randomString = getRandomString();
		if(randomString.length != 0) {
			var dir = createDirectory(path, randomString);
			if(dir.length != 0) {
				var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(dir);
				file.append(randomString);
				file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
				//saveFile(file.path, response);
				try {

					var sessionHistory = getWebNavigation().sessionHistory;
					var entry = sessionHistory.getEntryAtIndex(sessionHistory.index, false);
					var postData = entry.QueryInterface(Components.interfaces.nsISHEntry).postData;

				} catch(e) {}

				var referrer = null;
				var uri = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService).newURI(url, null, null);
					
				const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
				var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(nsIWBP);

				persist.persistFlags = Components.interfaces
					.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;

				persist.persistFlags |= Components.interfaces
					.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
					
				/*
				persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES
					| nsIWBP.PERSIST_FLAGS_DONT_FIXUP_LINKS
					| nsIWBP.PERSIST_FLAGS_FROM_CACHE;

				*/
				persist.saveURI(uri, null, referrer, postData, null, file);				
			}
		}
		
	} catch(e) {
		LogManager.logToConsole("SaveSource caught an exception " + e.name + ": " + e.message);
	}
	
    return file.path;
}

// http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
// Converts any ArrayBuffer to a string
//  (a comma-separated list of ASCII ordinals,
//  NOT a string of characters from the ordinals
//  in the buffer elements)
function arraybufferToString(buf) {
    return Array.prototype.join.call(Uint8Array(buf), ",");
}

/* Convert an inputstream to a scriptable inputstream */
function inputStreamToString(input) {

	try {
		if(input == null) {
			LogManager.logToConsole("inputStreamToString input is null");
			return ""; 
		}
		var str = "";
		//var stream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		//stream.init(input);
		//var str = stream.read(stream.available());
		return str;
	} catch(e) {
		LogManager.logToConsole("exception caught in inputStreamToString e: " + e.name + " " + e.message);
	}
    /*var SIStream = Components.Constructor(
        '@mozilla.org/scriptableinputstream;1',
        'nsIScriptableInputStream', 'init');
    return new SIStream(input);*/
}

// https://developer.mozilla.org/En/Code_snippets/Canvas

function SaveScreenShot(path, wnd)
{
    //LogManager.logToConsole("In SaveScreenShot");

	var pngBinary = "";
	
	// check if this firefox supports canvas
	var canvas_supported = true;

	try
	{
		//var canvas = document.getElementById("canvas");
		var canvas = wnd.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

		if (canvas == null)
			throw Exception;

		if (! ("toDataURL" in canvas))
			throw Exception;
	}
	catch(e) {
		// canvas not supported
		canvas_supported = false;
	}

	if (canvas_supported) {

		try {

			//var wnd = gBrowser.contentWindow;

			//var wnd = gBrowser.browsers[0].currentWindow;
			if(wnd.document.body == null)
			{
				LogManager.logToConsole("in screenshot window.document.body is null...returning");
				return {filepath : '', filesize : 0};
			}
			
			//var width = wnd.document.body.scrollWidth;
			var width = Math.max(wnd.document.documentElement.scrollWidth, wnd.document.body.scrollWidth);

			//var height = wnd.document.body.scrollHeight;
			var height = Math.max(wnd.document.documentElement.scrollHeight, wnd.document.body.scrollHeight);

			canvas.width = width;
			canvas.height = height;

			//LogManager.logToConsole("canvas.width = " + width);

			//LogManager.logToConsole("canvas.height = " + height);

			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawWindow(wnd, 0, 0, canvas.width, canvas.height, "rgba(0, 0, 0, 0)");
			//var result = canvas.toDataURL("image/png", "");

			pngBinary = canvas.toDataURL("image/png", "");

            var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			
			//var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
            //var source = io.newURI(pngBinary, "UTF8", null);
			
			if (pngBinary) {
				var randomString = getRandomString();
				if(randomString.length != 0) {
					var dir = createDirectory(path, randomString);
					if(dir.length != 0) {
						file.initWithPath(dir);
						file.append(randomString);
						file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
						
						var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
						var source = io.newURI(pngBinary, "UTF8", null);

						// prepare to save the canvas data
						var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
							.createInstance(Components.interfaces.nsIWebBrowserPersist);

						persist.persistFlags = Components.interfaces
							.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;

						persist.persistFlags |= Components.interfaces
							.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

						// save the canvas data to the file
						persist.saveURI(source, null, null, null, null, file);
						
						return {filepath : file.path, filesize : pngBinary.length};
					}
				}
				
			}
			
			/*
			if (pngBinary) {
				var sha1Digest = getSha1DigestFromUTF8String(pngBinary);
				if(sha1Digest.length != 0) {
					LogManager.logToConsole("sha1Digest: " + sha1Digest);
					var sha1Dir = createSha1Directory(path, sha1Digest);
					LogManager.logToConsole("path: " + sha1Dir);
					if(sha1Dir.length != 0) {
						file.initWithPath(sha1Dir);
						file.append(sha1Digest);
						LogManager.logToConsole("sha1 path: " + file.path);
						//saveFile(file.path, pngBinary);
						
						var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
						var source = io.newURI(pngBinary, "UTF8", null);

						// prepare to save the canvas data
						var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
							.createInstance(Components.interfaces.nsIWebBrowserPersist);

						persist.persistFlags = Components.interfaces
							.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;

						persist.persistFlags |= Components.interfaces
							.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

						// save the canvas data to the file
						persist.saveURI(source, null, null, null, null, file);
						
						return {filepath : file.path, filesize : pngBinary.length};
					}
				}
			}
			*/
			//file.initWithPath(path);

			// if too many files with a similiar filename exist createUnique will return an exception of NS_ERROR_FILE_TOO_BIG
			// to avoid this we will "help" in creating an initially random name
			//var random = getRandomInt(1, 1000);
			//file.append("img" + random + ".png");
    		//file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

            //LogManager.logToConsole("saving... " + file.path);

            //LogManager.logToConsoleHTML("<a href=\"" + filename + "\">" + "<img width=\"400\" src=\"" + filename + "\" />" + "</a>");



            // create a data url from the canvas and then create URIs of the source and targets
            /*var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);

            var source = io.newURI(pngBinary, "UTF8", null);

            //var target = io.newFileURI(file)

            // prepare to save the canvas data
            var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(Components.interfaces.nsIWebBrowserPersist);

            persist.persistFlags = Components.interfaces
            	.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;

            persist.persistFlags |= Components.interfaces
            	.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

            // save the canvas data to the file
            persist.saveURI(source, null, null, null, null, file);*/
			
			return {filepath : '', filesize : 0};
			//return file.path;
			
			//return {filepath : file.path, filesize : pngBinary.length};
        }
        catch(e) {

            LogManager.logToConsole("exception caught in SaveScreenShot e: " + e.name + " " + e.message);
			return {filepath : '', filesize : 0};
        }
    }
    else {

        // todo assign website default image
		return {filepath : '', filesize : 0};
    }

	return {filepath : '', filesize : 0};
}
