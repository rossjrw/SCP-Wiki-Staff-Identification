/*
SCP-Wiki Staff Identification
version 2.0
2018-10-03

--------------------------------------------------------------------
This is a Greasemonkey user script.

To install on Firefox, you need Greasemonkey: http://greasemonkey.mozdev.org/
Then restart Firefox and revisit this script.
Under Tools, there will be a new menu item to "Install User Script".
Accept the default configuration and install.

To uninstall, go to Tools/Manage User Scripts,
select "SCP-Wiki Staff Identification", and click Uninstall.
--------------------------------------------------------------------
*/

// ==UserScript==
// @name        SCP-Wiki Staff Identification 2
// @description Shows who's staff and what position they hold
// @include     http://www.scp-wiki.net/forum*
// @include     http://scp-wiki.wikidot.com/forum*
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// ==/UserScript==

"use strict";
var doCount = 0;
getStaffList();

// fetch the whole list of staff from 05command
function getStaffList() {
	GM.xmlHttpRequest({
		method: "GET",
		url: "http://05command.wikidot.com/staff-list",
		/*headers: {
			"User-Agent": "Mozilla/5.0",	// If not specified, navigator.userAgent will be used.
		},*/
		timeout: 10000,
		onload: function(response) {
			structureStaffList(response.responseText);
		},
		onerror: function(response) {
			console.error("An error occurred while fetching staff data");
		},
		ontimeout: function(response) {
			console.error("The request to fetch staff data timed out");
		}
	});
}

// rummage through the list of staff and twist it into a format that JS understands
function structureStaffList(staffText) {
	var parser = new DOMParser();
	var staffList = parser.parseFromString(staffText, "application/xml").getElementById('page-content');
	// next thing to do is to compile a list of all of the staff members
	var staff = [];
	var staffType = "Staff Member";
	// 4 tables:  admin, mod, opstaff, jstaff

	for(let node = 0; node < staffList.childNodes.length; node++) {
		var currNode = staffList.childNodes[node];

		// if the current node is not a table, we don't care about it, but if it's a title then we can use it to get the current staff type instead of hardcoding that
		switch(currNode.nodeName.toLowerCase()) {
			case "table":
				break;
			case "h1":
				// do something
				staffType = currNode.firstChild.textContent;
				continue;
			default:
				continue;
		}

		// if we got here, then we need to go deeper into the table
		for(let i = 0; i < currNode.childNodes.length; i++) { // starting at 1 because the first tr is the title
			var tr = currNode.childNodes[i];
			// there's a lot of empty text nodes for some reason, so we ignore these
			if(tr.nodeName !== "tr") continue;

			// iterate through the columns of the tr
			var td, columns = [];
			for(let j = 0; j < tr.childNodes.length; j++) {
				td = tr.childNodes[j];
				// there's a lot of empty text nodes for some reason, so we remove these
				if(td.nodeName !== "td") continue;
				// so each td is, in order: user | teams | timezone | activity | contact | captain
				//                          0      1       2          3          4         5
				// for JS, only 0 and 1 exist
				// now we shove each td into a clean array so we can iterate over it without the messy text nodes ruining life for everyone
				columns.push(td);
			}

			var staffmember = {username: "", teams: [], active: true, captain: [], type: staffType};

			for(let j = 0; j < columns.length; j++) {
				switch(j) {
					case 0: // username
						// extract the username from [[*user username]]
						staffmember.username = columns[j].childNodes[0].childNodes[1].textContent;
						break;
					case 1: // teams
						staffmember.teams = columns[j].textContent.split(", ");
						break;
					case 3: // activity
						if(columns[j].textContent.toLowerCase() === "inactive") {
							staffmember.active = false;
						}
						break;
					case 5: // captain
						staffmember.captain = columns[j].textContent.split(", ");
						break;
				}
			}
			// now let's do something incredibly lazy to drop this member if the tr is a title
			if(staffmember.username === "") continue;
			// push staff data into the staff list
			staff.push(staffmember);
		}
	}
	setStaffIds(staff);
}

// run through the fo
function setStaffIds(staff) {
	var container;
	if(document.getElementById('thread-container')) {
		container = document.getElementById('thread-container');
	} else {
		container = document.getElementsByClassName('thread-container')[0];
	}

	var infoSpans = container.getElementsByClassName('info');
	var userName = "";
	var staffName, staffId;

	for (var x = 0; x < infoSpans.length; x++) {
		try {
			userName = infoSpans[x].getElementsByTagName('span')[0].getElementsByTagName('a')[1].innerHTML;
		} catch(error) {
			// so far as I can tell this only errors for a deleted account, so ignore it
			continue;
		}

		if (infoSpans[x].innerHTML.indexOf("SCP Wiki -") === -1) {
			staffName = "";
			staffId = "";

			for (var y = 0; y < staff.length; y++) {
				staffName = staff[y].username;

				if (userName.indexOf(staffName) !== -1) {
					// I want to format this as "Administrator - Disciplinary" or "Junior Staff - Technical" or "Operational Staff (Inactive)"
					staffId = "SCP Wiki - " + staff[y].type;

					if(!staff[y].active) staffId += " (Inactive)";

					if(staff[y].captain.length > 0) {
						for(let i = 0; i < staff[y].captain.length; i++) {
							for(let j = 0; j < staff[y].teams.length; j++) {
								if(staff[y].captain[i] === staff[y].teams[j]) staff[y].teams[j] += " (Captain)";
							}
						}
					}
					if(staff[y].teams.length > 0) staffId += " - " + staff[y].teams.join(", ");
				}
			}

			if (staffId !== "") {
				var br = infoSpans[x].getElementsByTagName('br')[0];
				var staffSpan = document.createElement('span');
				staffSpan.style.fontSize = "0.8em";
				staffSpan.innerHTML = staffId + "<br>";

				if (br) {
					infoSpans[x].insertBefore(staffSpan, br.nextSibling);
				} else {
					br = document.createElement('br');
					infoSpans[x].appendChild(br);
					infoSpans[x].appendChild(staffSpan);
				}
			}
		}
	}
	// repeat this a few times just so that we catch everything if the forum loads slowly
	doCount++;
	if(doCount < 10) setTimeout(function() {setStaffIds(staff)}, 500);
}