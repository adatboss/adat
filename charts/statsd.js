function StatsdClient(httpApi, wsApi) {
	var _this = this,
		timeout = 2000;

	_this.httpApi = function () {
		return httpApi;
	};

	_this.wsApi = function () {
		return wsApi;
	};

	_this.timeout = function (t) {
		if (arguments.length == 0) {
			return timeout;
		} else {
			timeout = Math.max(0, t|0);
			return _this
		}
	};

	_this.archive = function (sources, from, granularity, length, callback) {
		var urlPrefix,
			urls = [],
			nFields = [],
			i;

		urlPrefix = httpApi +
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

		fetchCsv(urls, nFields, httpCallback(sources, callback));
	};

	_this.live = function (sources, callback) {
		var urlPrefix,
			urls = [],
			nFields = [],
			i;

		urlPrefix = httpApi + "?type=live";

		sources = parseSources(sources);
		for (i = 0; i < sources.length; i++) {
			urls[i] = urlPrefix +
				"&metric=" + sources[i].metric +
				"&channels=" + sources[i].channelsStr;
			nFields[i] = sources[i].channels.length;
		}

		fetchCsv(urls, nFields, httpCallback(sources, callback));
	};

	_this.archiveWatch = function (sources, offset, granularity, callback) {
		var urlPrefix,
			urls = [],
			nFields = [],
			i;

		urlPrefix = wsApi +
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

		return watch(urls, nFields, wsCallback(sources, callback));
	};

	_this.liveWatch = function (sources, callback) {
		var urlPrefix,
			urls = [],
			nFields = [],
			i;

		urlPrefix = wsApi + "?type=live";
		sources = parseSources(sources);
		for (i = 0; i < sources.length; i++) {
			urls[i] = urlPrefix +
				"&metric=" + sources[i].metric +
				"&channels=" + sources[i].channelsStr;
			nFields[i] = sources[i].channels.length;
		}

		return watch(urls, nFields, wsCallback(sources, callback));
	};

	_this.clockSkew = function (callback) {
		var url = httpApi + "?type=clockSkew" + "&ts=" + (+new Date);

		fetchCsv([url], [0], function (err, results) {
			if (err !== null) {
				callback(err, null);
				return;
			}
			callback(null, results[0][0][0]);
		});
	};

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
			} else {
				callback(null, merged);
			}
		};
	}

	function fetchCsv(urls, nFields, callback) {
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
			var req;

			try {
				req = new XMLHttpRequest();
				req.open("GET", urls[i]);
				req.timeout = timeout;
				req.onreadystatechange = readyStateChangeHandler;
				req.send();
			} catch (ex) {
				req = new XDomainRequest();
				req.open("GET", urls[i]);
				req.timeout = timeout;
				req.ontimeout = function () { error("Server unreachable"); };
				req.onerror = function () { error("Unknown error"); };
				req.onload = loadHandler;
				req.onprogress = function () {}; // IE9 workaround
				setTimeout(function () { req.send(); }, 0); // IE9 workaround
			}

			function readyStateChangeHandler() {
				if (req.readyState == XMLHttpRequest.DONE) {
					if (req.status == 0) {
						error("Server unreachable");
					} else if (Math.floor(req.status / 100) != 2) {
						error(req.responseText);
					} else {
						loadHandler();
					}
				}
			}

			function loadHandler() {
				responses[i] = parseCsv(req.responseText, nFields[i] + 1);
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

	function wsCallback(sources, callback) {
		return function (results) {
			var merged = mergeResults(results, sources);
			if (merged === null) {
				return;
			}
			callback(merged);
		};
	}

	function watch(urls, nFields, callback) {
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

				responses[i] = parseCsv(ev.data, nFields[i]+1);
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
				setTimeout(reinit, timeout);
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

	function parseCsv(csv, nFields) {
		var lines,
			line,
			field,
			output = [],
			i, j;

		for (i = 0; i < nFields; i++) {
			output[i] = [];
		}

		if (csv.length == 0) {
			return output;
		}

		lines = csv.split("\n");
		if (csv.substr(-1) == "\n") {
			lines.pop();
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
				output[j][i] = field;
			}
		}

		return output;
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

}

function StatsdCache(client) {
	var _this = this,
		cacheFactor = 1,
		sources = [],
		granularity = 60e3,
		currReq = null,
		nextReq = null,
		data = null,
		dataTs,
		dataLen,
		N = 0;

	_this.client = function () {
		return client;
	};

	_this.cacheFactor = function (cf) {
		if (arguments.length == 0) {
			return cacheFactor;
		} else {
			cacheFactor = isFinite(+cf) && +cf >= 0 ? +cf : 0;
			return _this;
		}
	};

	_this.invalidate = invalidate;

	_this.sources = function (src) {
		if (arguments.length == 0) {
			return sources.slice();
		} else {
			sources = src.slice();
			invalidate();
			return _this;
		}
	};

	_this.granularity = function (g) {
		if (arguments.length == 0) {
			return granularity;
		} else {
			granularity = g|0;
			invalidate();
			return _this;
		}
	};

	_this.query = query;

	function invalidate() {
		currReq = null;
		nextReq = null;
		data = null;
		N++;
	}

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

	_this.watch = function (offset, callback) {
		var n = N, close;

		if (sources.length == 0) {
			return null;
		}

		close = granularity != 1e3 ?
			client.archiveWatch(sources, offset, granularity, watchCallback) :
			client.liveWatch(sources, watchCallback);

		function watchCallback(d) {
			var expected, i;

			if (N != n) {
				close();
				return;
			}

			if (!needsRefill(d.ts, 1)) {
				expected = dataTs + data[0].length*granularity;
				if (d.ts == expected) {
					for (i = 0; i < data.length; i++) {
						data[i].push(d.data[i][0]);
						if (granularity == 1e3) {
							data[i].shift();
							dataTs += granularity;
						}
					}
				}
			}

			callback(d.ts);
		}

		return close;
	};

	function needsRefill(from, length) {
		return data === null ||
			(from < dataTs && granularity != 1e3) ||
			from + length*granularity > dataTs + dataLen*granularity;
	}

	function refill(from, length, callback) {
		var f = from - granularity*Math.round(length * cacheFactor),
			l = Math.round(length * (1 + 2*cacheFactor)),
			req = {
				from: from,
				length: length,
				callback: callback,
				reqFrom: f,
				reqLength: l
			};

		if (currReq) {
			nextReq = req;
		} else {
			currReq = req;
			if (granularity != 1e3) {
				client.archive(sources, f, granularity, l, refillCallback(N));
			} else {
				client.live(sources, refillCallback(N));
			}
		}
	}

	function refillCallback(n) {
		return function (err, d) {
			var cr = currReq,
				nr = nextReq,
				u1, u2,
				callback;

			if (N != n) {
				return;
			}

			currReq = nextReq = null;

			if (err === null) {
				data = d.data;
				if (d.ts !== null) {
					dataTs = d.ts;
					u1 = d.ts + granularity*d.data[0].length;
					u2 = cr.reqFrom  + granularity*cr.reqLength;
					dataLen = (Math.max(u1, u2) - d.ts) / granularity;
				} else {
					dataTs = cr.reqFrom;
					dataLen = cr.reqLength;
				}
			}

			if (nr) {
				query(nr.from, nr.length, nr.callback);
			} else {
				if (err === null) {
					reply(cr.from, cr.length, cr.callback);
				} else {
					callback = cr.callback;
					callback(err, null);
				}
			}

		};
	}

	function reply(from, length, callback) {
		var offset,
			output;

		offset = (from - dataTs) / granularity;
		if (offset < 0) {
			from -= offset * granularity;
			length += offset;
			offset = 0;
		}

		length = Math.max(0, length);

		output = {
			from: from,
			data: data.map(function (d) {
				return d.slice(offset, offset + length);
			})
		};

		callback(null, output);
	}
}
