statsd.config.httpApi = "http://192.168.1.101:5999/";
statsd.config.wsApi = "ws://192.168.1.101:5999/";
statsd.config.timeout = 1000;

function Chart(svg, fetcherFactory, liveFetcherFactory, clockSkew) {
	var	svg = d3.select(svg),
		defaultSettings = {
			width: 640,
			height: 480,
			backgroundColor: "#f8f8f8",
			fontSize: 12,
			fontFamily: "sans-serif",
			granularity: 60e3,
			xMax: null,
			xCount: 60,
			xTicks: 5,
			xGridColor: "#888",
			xLabelColor: "#000",
			xLocked: false,
			timeFormat1: "%m/%d/%y",
			timeFormat2: "%I:%M %p",
			yMin: 0,
			yMax: null,
			yTicks: 5,
			yGridColor: "#888",
			yLabelColor: "#000",
			yLocked: false,
			retry: 10e3,
			autorefresh: true,
			data: []
		},
		defaultData = {
			label: "?",
			channel: ".",
			autoY: true,
			color: "#f40",
			width: 1
		},
		margin = {t: 0, r: 0, b: 30, l: 50},
		settings,
		width,
		height,
		xScale = d3.time.scale(),
		yScale = d3.scale.linear(),
		fetcher,
		fetcherN = 0,
		values,
		ts,
		retryTimer = null,
		xAnchor = null,
		yAnchor = null,
		xChanged = false,
		yChanged = false,
		stopWatching = null,
		lastUpdate = null;

	this.settings = getsetSettings;

	clockSkew |= 0;
	setSettings(defaultSettings);
	createElements();
	init();

	function init() {
		showError(null);
		updateSize();
		setBackgroundColor();
		resetXDomain();
		redrawXGrid();
		redrawYGrid();
		resetData();
		reload();
	}

	function createElements() {
		var clipId = "clip-" + (+now()) + "-" + Math.ceil(Math.random() * 1e9);

		svg.style("font-size", settings.fontSize + "px")
			.style("font-family", settings.fontFamily);

		svg.append("rect")
			.classed("background", true)
			.style("shape-rendering", "crispEdges");

		svg.append("clipPath")
			.classed("clipPath", true)
			.attr("id", clipId)
			.append("rect");

		svg.append("g")
			.classed("grid", true);

		svg.append("g")
			.classed("lines", true)
			.attr("clip-path", "url(#" + clipId + ")");

		svg.append("rect")
			.classed("mouse", true)
			.style("fill-opacity", 0)
			.on("mousedown", xMousedown)
			.on("mouseup", xMouseup)
			.on("mousemove", xMousemove)
			.on("mouseout", xMouseout)
			.on("dblclick", dblclick);

		svg.append("rect")
			.classed("error", true)
			.style("fill", "rgba(255, 128, 128, 0.75)")
			.style("stroke", "#f00")
			.style("shape-rendering", "crispEdges");

		svg.append("text")
			.classed("error", true)
			.style("fill", "#000")
			.style("text-anchor", "middle");

		svg.append("clipPath")
			.classed("yClipPath", true)
			.attr("id", clipId + "-y")
			.append("rect");
			
		svg.append("g")
			.classed("yLabels", true)
			.attr("clip-path", "url(#" + clipId + "-y)");

		svg.append("rect")
			.classed("yMouse", true)
			.style("fill-opacity", 0)
			.on("mousedown", yMousedown)
			.on("mouseup", yMouseup)
			.on("mousemove", yMousemove)
			.on("mouseout", yMouseout)
			.on("dblclick", yDblclick);

		svg.append("clipPath")
			.classed("xClipPath", true)
			.attr("id", clipId + "-x")
			.append("rect");

		svg.append("g")
			.classed("xLabels", true)
			.attr("clip-path", "url(#" + clipId + "-x)");

		svg.append("rect")
			.classed("xMouse", true)
			.style("fill-opacity", 0)
			.on("mousedown", xMousedown)
			.on("mouseup", xMouseup)
			.on("mousemove", xMousemove)
			.on("mouseout", xMouseout)
			.on("dblclick", xDblclick);
	}

	function updateSize() {
		var translate = "translate(" + margin.l + " " + margin.t + ")";

		width = settings.width - margin.l - margin.r;
		height = settings.height - margin.t - margin.b;
		xScale.range([0.5, width - 0.5]);
		yScale.range([height-0.5, 0.5]);

		svg.attr("width", settings.width)
			.attr("height", settings.height);

		svg.selectAll(".background, .mouse")
			.attr("transform", translate)
			.attr("width", width)
			.attr("height", height);

		svg.select(".clipPath rect")
			.attr("width", width)
			.attr("height", height);
	
		svg.selectAll(".lines, .grid")
			.attr("transform", translate);

		svg.select("rect.error")
			.attr("x", margin.l + settings.fontSize + 0.5)
			.attr("y", margin.t + height - 3*settings.fontSize + 0.5)
			.attr("width", width - 2*settings.fontSize - 1)
			.attr("height", 2*settings.fontSize);

		svg.select("text.error")
			.attr("x", margin.l + width/2)
			.attr("y", margin.t + height - 1.65*settings.fontSize + 0.5);

		svg.select(".yClipPath rect")
			.attr("y", margin.t + 1)
			.attr("width", margin.l)
			.attr("height", height - 1);

		svg.select(".yMouse")
			.attr("transform", "translate(0 " + margin.t + ")")
			.attr("width", margin.l)
			.attr("height", height);

		svg.select(".xClipPath rect")
			.attr("x", margin.l)
			.attr("y", margin.t + height)
			.attr("width", width)
			.attr("height", margin.b);

		svg.select(".xMouse")
			.attr("transform", "translate(" + margin.l + " " + (margin.t + height) + ")")
			.attr("width", width)
			.attr("height", margin.b);
	}

	function setBackgroundColor() {
		svg.select(".background")
			.style("fill", settings.backgroundColor);
	}

	function showError(msg) {
		if (retryTimer !== null) {
			clearTimeout(retryTimer);
		}

		if (msg !== null) {
			svg.select("text.error")
				.text(msg);
			svg.selectAll(".error")
				.style("display", null);

			retryTimer = setTimeout(reload, settings.retry);
		} else {
			svg.selectAll(".error")
				.style("display", "none");
		}
	}

	function resetXDomain() {
		var n,
			offset,
			xMax,
			xMin;

		if (settings.xMax === null) {
			n = now();
			offset = n.getTimezoneOffset() * 60e3;
			xMax = (+n) + offset;
			xMax -= xMax%settings.granularity + offset;
		} else {
			xMax = settings.xMax;
		}
		xMin = xMax - settings.xCount*settings.granularity;
		xScale.domain([xMin, xMax]);
	}

	function resetYDomain() {
		var yMin = settings.yMin,
			yMax = settings.yMax,
			i, j;
			
		if (yMin === null) {
			yMin = Number.POSITIVE_INFINITY;
			for (i = 0; i < settings.data.length; i++) {
				if (settings.data[i].autoY) {
					for (j = 0; j < values[i].length; j++) {
						if (values[i][j] < yMin) {
							yMin = values[i][j];
						}
					}
				}
			}
		}

		if (yMax === null) {
			yMax = Number.NEGATIVE_INFINITY;
			for (i = 0; i < settings.data.length; i++) {
				if (settings.data[i].autoY) {
					for (j = 0; j < values[i].length; j++) {
						if (values[i][j] > yMax) {
							yMax = values[i][j];
						}
					}
				}
			}
		}

		if (isFinite(yMin) && isFinite(yMax)) {
			if (yMin == yMax) {
				if (yMin == 0) {
					yMax = 1;
				} else {
					yMin /= 2;
					yMax *= 1.5;
				}
			}

			yScale.domain([yMin, yMax]);
			if (settings.yMin == null || settings.yMax == null) {
				yScale.nice();
			}
		}
	}

	function redrawLines() {
		var lines = svg.select(".lines").selectAll("path").data(values),
			line = d3.svg.line()
				.x(function (d, i) {
					return xScale(ts + (i + 0.5)*settings.granularity);
				})
			.y(yScale);

		lines.enter().append("path");
		lines.exit().remove();
	
		lines.attr("d", line)
			.attr("stroke", function (d, i) {
				return settings.data[i].color;
			})
			.attr("stroke-width", function (d, i) {
				return settings.data[i].width;
			})
			.attr("fill", "none");
	}

	function redrawXGrid() {
		var ticks = xScale.ticks(settings.xTicks),
			grid = svg.select(".grid").selectAll(".xGrid").data(ticks),
			labels1 = svg.select(".xLabels").selectAll("text.l1").data(ticks),
			labels2 = svg.select(".xLabels").selectAll("text.l2").data(ticks);

		grid.enter().append("line")
			.classed("xGrid", true)
			.style("stroke", settings.xGridColor)	
			.style("shape-rendering", "crispEdges");
		grid.exit().remove();
		grid.attr("x1", roundX)
			.attr("y1", 0)
			.attr("x2", roundX)
			.attr("y2", height);

		labels1.exit().remove();
		labels1.enter().append("text")
			.classed("l1", true)
			.style("text-anchor", "middle")
			.style("fill", settings.xLabelColor);
		labels1.text(d3.time.format(settings.timeFormat1))
			.attr("x", function (d, i) { return margin.l + roundX(d, i); })
			.attr("y", margin.t + height + 1.1*settings.fontSize);

		labels2.exit().remove();
		labels2.enter().append("text")
			.classed("l2", true)
			.style("text-anchor", "middle")
			.style("fill", settings.xLabelColor);
		labels2.text(d3.time.format(settings.timeFormat2))
			.attr("x", function (d, i) { return margin.l + roundX(d, i); })
			.attr("y", margin.t + height + 2.2*settings.fontSize);
	}

	function redrawYGrid() {
		var ticks = yScale.ticks(settings.yTicks),
			grid = svg.select(".grid").selectAll(".yGrid").data(ticks),
			labels = svg.select(".yLabels").selectAll("text").data(ticks);

		grid.exit().remove();
		grid.enter().append("line")
			.classed("yGrid", true)
			.style("stroke", settings.yGridColor)
			.style("shape-rendering", "crispEdges");
		grid.attr("x1", 0)
			.attr("y1", roundY)
			.attr("x2", width)
			.attr("y2", roundY)

		labels.exit().remove();
		labels.enter().append("text")
			.style("text-anchor", "end")
			.style("fill", settings.yLabelColor);
		labels.text(formatNumber)
			.attr("x", margin.l-2)
			.attr("y", function (d, i) { return margin.t + roundY(d, i); });

	}

	function reload() {
		var N = fetcherN,
			offset = now().getTimezoneOffset() * 60e3,
			domain = xScale.domain(),
			from,
			until,
			length;

		from = Math.floor(((+domain[0]) + offset)/settings.granularity - 0.5);
		from = (from * settings.granularity) - offset;

		until = Math.ceil(((+domain[1]) + offset)/settings.granularity - 0.5);
		until = (until * settings.granularity) - offset;

		length = (until - from) / settings.granularity + 1;

		fetcher.query(from, length, function (err, d) {
			if (fetcherN != N) {
				return;
			}
	
			showError(err);
			if (err !== null) {
				return;
			}

			setData(d);
		});
	}

	function setData(d) {
		values = d.data;
		ts = d.ts;
		if (!yChanged) {
			resetYDomain();
		}
		redrawYGrid();
		redrawLines();
	}

	function resetData() {
		var channels = settings.data.map(function (e) { return e.channel; }),
			ff;

		if (settings.granularity != 1e3) {
			ff = fetcherFactory;
		} else {
			ff = liveFetcherFactory;
		}

		fetcher = ff(channels, settings.granularity);
		fetcherN++;
		if (settings.autorefresh) {
			startWatching();
		}
		values = [];
		ts = null;
	}

	function startWatching() {
		var N = fetcherN,
			offset = now().getTimezoneOffset() * 60e3;

		if (stopWatching !== null) {
			stopWatching();
		}

		stopWatching = fetcher.watch(offset, function (ts) {
			var d, t;

			clockSkew += settings.granularity + ts - now().getTime();
	
			if (fetcherN != N) {
				return;
			}

			if (settings.granularity != 1e3) {
				if (!xChanged) {
					resetXDomain();
					redrawXGrid();
					redrawLines();
				}

				d = xScale.domain();
				if (ts > d[0] && ts < d[1]) {
					reload();
				}
			} else {
				d = xScale.domain();
				t = lastUpdate != null ? ts - lastUpdate : 1e3;
				lastUpdate = ts;
				xScale.domain([+d[0] + t, +d[1] + t]);
				redrawXGrid();
				redrawLines();
				reload();
			}
		});
	}

	function xMousedown() {
		if (settings.xLocked) {
			return;
		}

		xAnchor = +xScale.invert(d3.mouse(this)[0]);
		d3.event.preventDefault();
	}

	function xMouseup() {
		xAnchor = null;
	}

	function xMousemove() {
		var t = xScale.invert(d3.mouse(this)[0]),
			d = xScale.domain();

		if (xAnchor === null) {
			return;
		}

		d = [+d[0], +d[1]];

		if (d3.event.shiftKey) {
			d[0] = d[1] - (d[1] - xAnchor)/(d[1] - t)*(d[1] - d[0]);
		} else {
			d[0] += xAnchor - t;
			d[1] += xAnchor - t;
		}
		xScale.domain(d);
		xChanged = true;
		redrawXGrid();
		redrawLines();
		reload();
	}

	function xMouseout() {
		var rtg = d3.select(d3.event.relatedTarget);
		if (rtg.size() && !rtg.classed("mouse") && !rtg.classed("xMouse")) {
			xAnchor = null;
		}
	}

	function xDblclick() {
		xChanged = false;
		resetXDomain();
		redrawXGrid();
		redrawLines();
		reload();
	}

	function yMousedown() {
		if (settings.yLocked) {
			return;
		}

		yAnchor = yScale.invert(d3.mouse(this)[1]);
		d3.event.preventDefault();
	}

	function yMouseup() {
		yAnchor = null;
	}

	function yMousemove() {
		var v = yScale.invert(d3.mouse(this)[1]),
			d = yScale.domain();

		if (yAnchor === null) {
			return;
		}

		if (d3.event.shiftKey) {
			d[1] = d[0] + (d[0] - yAnchor)/(d[0] - v)*(d[1] - d[0]);
		} else {
			d[0] += yAnchor - v;
			d[1] += yAnchor - v;
		}
		yScale.domain(d);
		yChanged = true;
		redrawYGrid();
		redrawLines();
	}

	function yMouseout() {
		yAnchor = null;
	}

	function yDblclick() {
		yChanged = false;
		resetYDomain();
		redrawYGrid();
		redrawLines();
	}
	
	function dblclick() {
		xChanged = false;
		resetXDomain();
		redrawXGrid();
		yChanged = false;
		resetYDomain();
		redrawYGrid();
		reload();
	}

	function now() {
		return new Date((+new Date) + clockSkew);
	}

	function roundX(d) {
		return Math.round(xScale(d) - 0.5) + 0.5;
	}

	function roundY(d) {
		return Math.round(yScale(d) - 0.5) + 0.5;
	}

	function formatNumber(x) {
		var PFX = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"],
			pfx = ["", "m", "µ", "n", "p", "f", "a", "z", "y"],
			s = x < 0 ? "-" : "",
			i = 0, j = 0,
			a, b, u,

		x = Math.abs(x);

		if (x == 0) {
			return "0";
		}

		if (x < 1) {
			while (x < 1 && i < pfx.length-1) {
				x *= 1000;
				i++;
			}
			u = pfx[i];
		} else {
			while (x >= 1000 && i < PFX.length-1) {
				x /= 1000;
				i++;
			}
			u = PFX[i];
		}

		while (Math.round(x) < 1000) {
			x *= 10;
			j++;
		}
		x = Math.round(x) + "";
		a = x.substr(0, 4-j);
		b = x.substr(4-j);
		for (i = 0; i < b.length; i++) {
			if (b[i] != "0") {
				a = a + "." + b;
				break;
			}
		}

		return s + a + u;
	}

	function copyObj(src, dst, def) {
		if (def === null) {
			def = src;
		}
		for (var k in def) {
			if (typeof src[k] != "undefined") {
				dst[k] = src[k];
			} else {
				dst[k] = def[k];
			}
		}
		return dst;
	}

	function getSettings() {
		var st = copyObj(settings, {}, null),
			i;

		st.data = [];
		for (i = 0; i < settings.data.length; i++) {
			st.data[i] = copyObj(settings.data[i], {}, null);
		}

		return st;
	}

	function setSettings(s) {
		var st = copyObj(s, {}, defaultSettings),
			i;

		st.data = [];
		if (typeof s.data != "undefined") {
			for (i = 0; i < s.data.length; i++) {
				st.data[i] = {};
				copyObj(s.data[i], st.data[i], defaultData);
			}
		}

		if (st.granularity < 60e3) {
			st.granularity = 1e3;
			st.xMax = null;
			st.xCount = Math.min(599, st.xCount);
		}

		settings = st;
	}

	function getsetSettings(s) {
		if (arguments.length == 0) {
			return getSettings();
		} else {
			setSettings(s);
			init();
		}
	}

}


window.onload = function () {
	chart = new Chart("#chart", statsd.cache, statsd.liveCache, 0);
	chart.settings({
		data: [
			{
				label: "Test0",
				channel: "test0:counter",
				color: "#f40",
				width: 2,

			},
			{
				label: "Test1",
				channel: "test1:counter",
				color: "#4a0",
				width: 2,
			}
		]
	});
}
