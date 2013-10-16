var statsd = function () {

function config(values) {
	for (var k in config) {
		if (typeof values[k] != "undefined") {
			config[k] = values[k];
		}
	}
}

config.httpApi = "/";
config.wsApi = "/";
config.timeout = 2000;
config.cacheFactor = 1;

function archive(sources, from, granularity, length, callback) {
	var urlPrefix,
		urls = [],
		nFields = [],
		i;

	urlPrefix = config.httpApi +
		"?type=archive" +
		"&from=" + encodeURIComponent(from / 1000) +
		"&length=" + encodeURIComponent(length) +
		"&granularity=" + encodeURIComponent(granularity / 1000);

	sources = parseSources(sources);
	for (i = 0; i < sources.length; i++) {
		urls[i] = urlPrefix +
			"&metric=" + sources[i].metric +
			"&channels=" + sources[i].channelsStr;
		nFields[i] = sources[i].channels.length;
	}

	fetchData(urls, nFields, httpCallback(sources, callback));
}

function live(sources, callback) {
	var urlPrefix,
		urls = [],
		nFields = [],
		i;

	urlPrefix = config.httpApi + "?type=live";
	sources = parseSources(sources);
	for (i = 0; i < sources.length; i++) {
		urls[i] = urlPrefix +
			"&metric=" + sources[i].metric +
			"&channels=" + sources[i].channelsStr;
		nFields[i] = sources[i].channels.length;
	}

	fetchData(urls, nFields, httpCallback(sources, callback));
}

function archiveWatch(sources, offset, granularity, callback) {
	var urlPrefix,
		urls = [],
		nFields = [],
		i;

	urlPrefix = config.wsApi +
		"?type=archive" +
		"&offset=" + encodeURIComponent(offset / 1000) +
		"&granularity=" + encodeURIComponent(granularity / 1000);

	sources = parseSources(sources);
	for (i = 0; i < sources.length; i++) {
		urls[i] = urlPrefix +
			"&metric=" + sources[i].metric +
			"&channels=" + sources[i].channelsStr;
		nFields[i] = sources[i].channels.length;
	}

	return watchData(urls, nFields, wsCallback(sources, callback));
}

function httpCallback(sources, callback) {
	return function (error, results) {
		var merged;

		if (error !== null) {
			callback(error, null);
			return;
		}

		merged = mergeResults(results, sources);
		if (merged === null) {
			callback("Invalid response from server", null);
			return;
		}

		callback(null, merged);
	};
}

function liveWatch(sources, callback) {
	var urlPrefix,
		urls = [],
		nFields = [],
		i;

	urlPrefix = config.wsApi + "?type=live";
	sources = parseSources(sources);
	for (i = 0; i < sources.length; i++) {
		urls[i] = urlPrefix +
			"&metric=" + sources[i].metric +
			"&channels=" + sources[i].channelsStr;
		nFields[i] = sources[i].channels.length;
	}

	return watchData(urls, nFields, wsCallback(sources, callback));
}

function clockSkew(callback) {
	var url = config.httpApi + "?type=clockSkew" + "&ts=" + (+new Date);

	fetchData([url], [0], function (err, results) {
		if (err !== null) {
			callback(err, null);
			return;
		}
		callback(null, results[0][0][0]);
	});
}

function wsCallback(sources, callback) {
	return function (results) {
		var merged = mergeResults(results, sources);
		if (merged === null) {
			return;
		}
		callback(merged);
	};
}

function fetchData(urls, nFields, callback) {
	var responses = [],
		failed = false,
		N = 0,
		i;

	for (i = 0; i < urls.length; i++) {
		issueRequest(i);
	}

	if (urls.length == 0) {
		callback(null, []);
	}

	function issueRequest(i) {
		var request;

		try {
			request = new XMLHttpRequest();
			request.open("GET", urls[i]);
			request.timeout = config.timeout;
			request.onreadystatechange = readyStateChangeHandler;
			request.send();
		} catch (ex) {
			request = new XDomainRequest();
			request.open("GET", urls[i]);
			request.timeout = config.timeout;
			request.ontimeout = function () { error("Server unreachable"); };
			request.onerror = function () { error("Unknown error"); };
			request.onload = loadHandler;
			request.onprogress = function () {};
			setTimeout(function () { request.send(); }, 0);
		}

		function readyStateChangeHandler() {
			if (request.readyState == XMLHttpRequest.DONE) {
				if (request.status == 0) {
					error("Server unreachable");
				} else if (Math.floor(request.status / 100) != 2) {
					error(request.responseText);
				} else {
					loadHandler();
				}
			}
		}

		function loadHandler() {
			responses[i] = parseResponse(request.responseText, nFields[i] + 1);
			if (responses[i] === null) {
				error("Invalid response from server");
			} else if (++N == urls.length) {
				callback(null, responses);
			}
		}

		function error(msg) {
			if (failed) {
				return;
			}
			failed = true;
			callback(msg, null);
		}
	}
}

function watchData(urls, nFields, callback) {
	var responses = [],
		sockets = [],
		maxTs,
		N = 0,
		i;

	if (typeof WebSocket == "undefined") {
		return null;
	}

	for (i = 0; i < urls.length; i++) {
		openConnection(i);
	}

	return close;

	function openConnection(i) {
		init();

		function init() {
			sockets[i] = new WebSocket(urls[i]);
			sockets[i].onmessage = messageHandler;
			sockets[i].onclose = closeHandler;
		}

		function messageHandler(ev) {
			var ts;

			responses[i] = parseResponse(ev.data, nFields[i]+1);
			if (responses[i] === null || !responses[i][0].length) {
				return;
			}
			ts = responses[i][0][0];

			if (N == 0) {
				maxTs = ts;
			}
			if (ts > maxTs) {
				maxTs = ts;
				N = 0;
			}
			if (ts == maxTs) {
				if (++N == urls.length) {
					N = 0;
					callback(responses);
				}
			}
		 }

		 function closeHandler(ev) {
			setTimeout(reinit, config.timeout);
		 }

		 function reinit() {
		 	if (sockets[i] !== null) {
				init();
			}
		 }
	}

	function close() {
		var i;
		for (i = 0; i < sockets.length; i++) {
			if (sockets[i] !== null) {
				sockets[i].close();
				sockets[i] = null;
			}
		}
	}

}

function mergeResults(input, sources) {
	var maxTs = Number.NEGATIVE_INFINITY,
		minLen = Number.POSITIVE_INFINITY,
		output = {ts: null, data: []},
		channel,
		data,
		i, j, k;

	if (sources.length == 0) {
		return output;
	}

	for (i = 0; i < sources.length; i++) {
		for (j = 0; j < sources[i].channels.length; j++) {
			for (k = 0; k < sources[i].channels[j].indices.length; k++) {
				output.data.push([]);
			}
		}
	}

	for (i = 0; i < input.length; i++) {
		if (input[i][0].length == 0) {
			return output;
		}
		if (input[i][0][0] > maxTs) {
			maxTs = input[i][0][0];
		}
	}

	for (i = 0; i < input.length; i++) {
		data = input[i];
		while (data[0].length > 0 && data[0][0] < maxTs) {
			for (j = 0; j < data.length; j++) {
				data[j].shift();
			}
		}
		if (data[0].length < minLen) {
			minLen = data[0].length;
		}
		if (minLen == 0) {
			return output;
		}
		if (data[0][0] != maxTs) {
			return null;
		}
	}

	output.ts = maxTs*1000;

	for (i = 0; i < sources.length; i++) {
		for (j = 0; j < sources[i].channels.length; j++) {
			channel = sources[i].channels[j];
			data = input[i][j+1];
			data.length = minLen;
			output.data[channel.indices[0]] = data;
			for (k = 1; k < channel.indices.length; k++) {
				output.data[channel.indices[k]] = data.slice();
			}
		}
	}

	return output;
}

function parseSources(sources) {
	var output = [],
		metric,
		type,
		channel,
		obj,
		i, j, k;

	for (i = 0; i < sources.length; i++) {
		j = sources[i].indexOf(":");
		metric = sources[i].substr(0, j);
		channel = sources[i].substr(j+1).replace(",", "_");
		j = channel.indexOf("-");
		type = j == -1 ? channel : channel.substr(0, j);

		for (j = 0; j < output.length; j++) {
			obj = output[j];
			if (obj.metric == metric && obj.type == type) {
				for (k = 0; k < obj.channels.length; k++) {
					if (obj.channels[k].channel == channel) {
						obj.channels[k].indices.push(i);
						break;
					}
				}
				if (k == obj.channels.length) {
					obj.channels[k] = {channel: channel, indices: [i]};
					obj.channelsStr += ","+encodeURIComponent(channel);
				}
				break;
			}
		}
		if (j == output.length) {
			output[j] = {
				metric: metric,
				type: type,
				channels: [{channel: channel, indices: [i]}],
				channelsStr: encodeURIComponent(channel)
			};
		}
	}

	return output;
}

function parseResponse(csv, nFields) {
	var 
		lines = csv.split("\n"),
		line,
		field,
		output = [],
		i, j;

	if (csv.substr(-1) == "\n") {
		lines.pop();
	}

	for (i = 0; i < nFields; i++) {
		output[i] = [];
	}

	if (csv.length == 0) {
		return output;
	}

	for (i = 0; i < lines.length; i++) {
		line = lines[i].split(",");
		if (line.length != nFields) {
			return null;
		}
		for (j = 0; j < nFields; j++) {
			field = line[j];
			if (field == "+Inf") {
				field = Number.MAX_VALUE;
			} else if (field == "-Inf") {
				field = -Number.MAX_VALUE;
			} else if (field == "NaN") {
				field = 0;
			} else {
				field = +field;
				if (isNaN(field)) {
					return null;
				}
			}
			output[j][i] = +field;
		}
	}

	return output;
}

function cache(sources, granularity) {
	var cacheTs,
		cacheLength,
		cacheData = null,
		current = null,
		next = null;

	function query(from, length, callback) {
		if (sources.length == 0) {
			callback(null, {ts: null, data: []});
		} else {
			if (needsRefill(from, length)) {
				refill(from, length, callback);
			} else {
				reply(from, length, callback);
			}
		}
	}

	function watch(offset, callback) {
		if (sources.length == 0) {
			return null;
		}

		return archiveWatch(sources, offset, granularity, function (d) {
			var expected, i;

			if (!needsRefill(d.ts, 1)) {
				expected = cacheTs + cacheData[0].length*granularity;
				if (d.ts == expected) {
					for (i = 0; i < cacheData.length; i++) {
						cacheData[i].push(d.data[i][0]);
					}
				} else if (d.ts > expected) {
					cacheData = null;
				}
			}
			callback(d.ts);
		});
	};

	return {query: query, watch: watch};

	function needsRefill(from, length) {
		return cacheData === null ||
			from < cacheTs ||
			from + length*granularity > cacheTs + cacheLength*granularity;
	}

	function reply(from, length, callback) {
		var offset,
			output;
	
		offset = (from - cacheTs) / granularity;
		output = {
			ts: null,
			data: cacheData.map(function (d) {
				return d.slice(offset, offset + length);
			})
		};
		if (output.data.length != 0) {
			output.ts = from;
		}
		
		callback(null, output);
	}

	function refill(from, length, callback) {
		var cf = Math.max(0, config.cacheFactor),
			qFrom = from - granularity*Math.round(length * cf),
			qLength = Math.round(length * (1 + 2*cf)),
			q = {
				from: from,
				length: length,
				callback: callback,
				qFrom: qFrom,
				qLength: qLength};
	
		if (current) {
			next = q;
		} else {
			current = q;
			archive(sources, qFrom, granularity, qLength, refillCallback);
		}
	}

	function refillCallback(error, data) {
		var c = current,
			n = next,
			cb;

		current = next = null;

		if (error === null) {
			cacheTs = c.qFrom;
			cacheLength = c.qLength;
			cacheData = data.data;
		}

		if (n) {
			query(n.from, n.length, n.callback);
		} else {
			if (error === null) {
				reply(c.from, c.length, c.callback);
			} else {
				cb = c.callback;
				cb(error, null);
			}
		}
	}

}

function liveCache(sources) {
	var cacheTs,
		cacheData = null,
		current = null,
		next = null;

	function query(from, length, callback) {
		if (sources.length == 0) {
			callback(null, {ts: null, data: []});
		} else {
			if (cacheData === null) {
				refill(from, length, callback);
			} else {
				reply(from, length, callback);
			}
		}
	}

	function watch(offset, callback) {
		if (sources.length == 0) {
			return null;
		}

		return liveWatch(sources, function (d) {
			var expected, i;

			if (cacheData !== null) {
				expected = cacheTs + cacheData[0].length*1e3;
				if (d.ts == expected) {
					for (i = 0; i < cacheData.length; i++) {
						cacheData[i].push(d.data[i][0]);
						cacheData[i].shift();
					}
					cacheTs += 1e3;
				} else if (d.ts > expected) {
					cacheData = null;
				}
			}
			callback(d.ts);
		});
	}

	return {query: query, watch: watch}

	function reply(from, length, callback) {
		var offset,
			output;

		offset = (from - cacheTs) / 1e3;
		if (offset < 0) {
			from -= offset * 1e3;
			offset = 0;
		}

		output = {
			ts: null,
			data: cacheData.map(function (d) {
				return d.slice(offset, offset + length);
			})
		};
		if (output.data.length != 0) {
			output.ts = from;
		}

		callback(null, output);
	}

	function refill(from, length, callback) {
		var q = {
			from: from,
			length: length,
			callback: callback
		};

		if (current) {
			next = q;
		} else {
			current = q;
			live(sources, refillCallback);
		}
	}

	function refillCallback(error, data) {
		var c = current,
			n = next,
			cb;

		current = next = null;

		if (error === null) {
			cacheTs = data.ts;
			cacheData = data.data;
		}

		if (n) {
			query(n.from, n.length, n.callback)
		} else {
			if (error === null) {
				reply(c.from, c.length, c.callback);
			} else {
				cb = c.callback;
				cb(error, null);
			}
		}
	}

}

return {
	config: config,
	archive: archive,
	archiveWatch: archiveWatch,
	live: live,
	liveWatch: liveWatch,
	cache: cache,
	liveCache: liveCache,
	clockSkew: clockSkew
};

}();
