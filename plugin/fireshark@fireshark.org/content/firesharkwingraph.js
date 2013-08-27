
/*

Copyright 2007-2009 Stephan Chenette

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

function onFSWinGraphLoad() {

	try {
		// import singleton objects
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");

		//LogManager.logToConsole("onFSWinGraphLoad called");

		//LogManager.logToConsole("onFSWinGraphLoad registering callback");
		Fireshark.registerCallback(firesharkgraphEventCallback);

	} catch(e) {
		
		document.getElementById('canvas').innerHTML += "onFSWinGraphLoad caught an exception: " + e.name + ": " + e.message;
		LogManager.logToConsole("onFSWinGraphLoad caught an exception: " + e.name + ": " + e.message);
	}
};

function onFSWinGraphUnLoad() {

	try {
		// import singleton objects
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");

		//LogManager.logToConsole("onFSWinGraphUnLoad called");

		//LogManager.logToConsole("onFSWinGraphUnLoad unregistering callback");
		Fireshark.unregisterCallback(firesharkgraphEventCallback);

	} catch(e) {
		
		document.getElementById('canvas').innerHTML += "onFSWinGraphLoad caught an exception: " + e.name + ": " + e.message;
		LogManager.logToConsole("onFSWinGraphLoad caught an exception: " + e.name + ": " + e.message);
	}
};


function drawgraph() {

	try {
		// import singleton objects
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");

		// clear graph layout
		document.getElementById('canvas').innerHTML = "";

		var g = new Graph();
		var height = 0;
		var width = 0;
		var loadurlcount = 0;
		
		//LogManager.logToConsole("firesharkgraphEventCallback Fireshark.eventArray has " + Fireshark.eventArray.length + " items");

		var nodeArray = new Array();
		for(var i=0; i<Fireshark.eventArray.length; i++) {
			
			var e = Fireshark.eventArray[i];

			if(typeof(e) == "undefined") {
				//LogManager.logToConsole("firesharkgraphEventCallback e is undefined!!");
				continue;
			}

			LogManager.logToConsole("firesharkgraphEventCallback event.eventType = " + e.eventType);

			if(e.eventType == "loadurl") { 

				loadurlcount++;
				//LogManager.logToConsole("firesharkgraphEventCallback loadurl event found");

			} else if(e.eventType == "connection") { 

				var src = e.src;
				var dst = e.dst;

				// remove scheme from url
				src = src.replace(/^.*:\/\//g, '');
				dst = dst.replace(/^.*:\/\//g, '');

				// remove path from url
				src = src.replace(/\/.*$/g, '');
				dst = dst.replace(/\/.*$/g, '');

				nodeArray[src] = src;
				nodeArray[dst] = dst;

				//LogManager.logToConsole("src: " + src + "--> dst: " + dst);
			
				g.addNode(src);
				g.addNode(dst);

				// connect nodes with edges 
				if(e.type == "request") {

					g.addEdge(src, dst, { directed : true });

				} else if(e.type == "response") {

					g.addEdge(src, dst, { directed : true, label : e.status });

				}
			}
		}

		var nodecount = 0;
		for(var n in nodeArray) {

			nodecount++;
		}

		if(nodecount == 1) {

			width = 160;
			height =  50;

		} else if(nodecount == 2) {

			width = 80*nodecount;
			height =  50*nodecount;

		} else if(nodecount > 0) {

			width = 80 + ((nodecount-1)*(60));
			height =  50 + ((nodecount-1)*(40));
		}

		//LogManager.logToConsole("loadurlcount: " + loadurlcount);
		//LogManager.logToConsole("nodecount: " + nodecount);
		//LogManager.logToConsole("width: " + height);
		//LogManager.logToConsole("height: " + height);

		// layout the graph using the Spring layout implementation 
		var layouter = new Graph.Layout.Spring(g);
		layouter.layout();

		// draw the graph using the RaphaelJS draw implementation 
		var renderer = new Graph.Renderer.Raphael('canvas', g, width, height);
		renderer.draw();

	} catch(e) {

		LogManager.logToConsole("drawgraph caught an exception: " + e.name + ": " + e.message);
	}
}

function firesharkgraphEventCallback(event) {

	try {
		// import singleton objects
		Components.utils.import("resource://content/logmanager.js");
		Components.utils.import("resource://content/fireshark.js");

		//LogManager.logToConsole("firesharkgraphEventCallback called");

		if(event.eventType == "loadurlsend") {

			drawgraph();
		}

	} catch(e) {

		LogManager.logToConsole("firesharkgraphEventCallback caught an exception: " + e.name + ": " + e.message);
	}
}
