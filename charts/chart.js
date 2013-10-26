function Chart(selector) {
	var _this = this;

	// Elements
	var svg = d3.select(selector),
		graphClipRect,
		graphG,
		backgroundRect,
		yGridG,
		xGridG,
		xAxisClipRect,
		xAxisG,
		yAxisClipRect,
		yAxisG,
		errorClipRect,
		errorG,
		errorText,
		errorRect,
		mouseRect,
		xMouseRect,
		yMouseRect,
		linesG;

	// Settings
	var	setters = {},
		S = {};

	addSetting( "width",              "int",          640          );
	addSetting( "height",             "int",          480          );
	addSetting( "marginTop",          "int",          0            );
	addSetting( "marginRight",        "int",          0            );
	addSetting( "marginBottom",       "int",          30           );
	addSetting( "marginLeft",         "int",          50           );
	addSetting( "backgroundColor",    "str",          "#f8f8f8"    );
	addSetting( "fontSize",           "int",          12           );
	addSetting( "fontFamily",         "str",          "sans-serif" );
	addSetting( "xGridLines",         "int",          5            );
	addSetting( "xGridColor",         "str",          "#888"       );
	addSetting( "xLabelFormat1",      "str",          "%m/%d/%y"   );
	addSetting( "xLabelFormat2",      "str",          "%I:%M %p"   );
	addSetting( "xLabelColor",        "str",          "#000"       );
	addSetting( "xLocked",            "bool",         false        );
	addSetting( "yGridLines",         "int",          5            );
	addSetting( "yGridColor",         "str",          "#888"       );
	addSetting( "yLocked",            "bool",         false        );
	addSetting( "errorMsg",           "str",          ""           );
	addSetting( "data",               "num[][]",      []           );
	addSetting( "ts",                 "num",          0            );
	addSetting( "granularity",        "num",          60e3         );
	addSetting( "lineColors",         "str[]",        []           );
	addSetting( "lineWidths",         "int[]",        []           );
	addScaleSetting("xDomain", "xScale", d3.time.scale().domain([0, 3600e3]));
	addScaleSetting("yDomain", "yScale", d3.scale.linear().domain([0, 10]));

	function addSetting(name, type, def) {
		setters[name] = function (v) {
			S[name] = coerce[type](v);
		}

		_this[name] = function (v) {
			if (arguments.length == 0) {
				return S[name];
			} else {
				setters[name](v);
				redraw();
				return _this;
			}
		};

		S[name] = def;
	}

	function addScaleSetting(name, iname, def) {
		setters[name] = function (v) {
			S[iname].domain(coerce["num[]"](v));
			dispatch[name.toLowerCase()].call(_this);
		}
		
		_this[name] = function (v) {
			if (arguments.length == 0) {
				return S[iname].domain();
			} else {
				setters[name](v);
				redraw();
				return _this;
			}
		}

		S[iname] = def;
	}

	_this.settings = function (s) {
		var k, r = {};
		if (arguments.length == 0) {
			for (k in setters)  {
				r[k] = S[k];
			}
			return r;
		} else {
			for (k in s) {
				if (typeof setters[k] != "undefined") {
				console.log(k, s[k]);
					setters[k](s[k]);
				}
			}
			redraw();
			return _this;
		}
	};

	// Event handling
	var dispatch = d3.dispatch(
			"xdomain",
			"ydomain",
			"xdblclick",
			"ydblclick",
			"dblclick"
		),
		xAnchor = null,
		yAnchor = null;

	d3.rebind(_this, dispatch, "on")

	// Initialization
	createElements();
	redraw();

	function createElements() {
		var clipId = "clip-" + +new Date + "-" + Math.ceil(Math.random() * 1e9);

		svg.style("overflow", "hidden");

		// Graph area
		graphClipRect = svg.append("clipPath")
			.attr("id", clipId)
			.append("rect");

		graphG = svg.append("g")
			.attr("clip-path", "url(#" + clipId + ")");

		backgroundRect = graphG.append("rect")
			.style("shape-rendering", "crispEdges");

		xGridG = graphG.append("g")
			.style("shape-rendering", "crispEdges");

		yGridG = graphG.append("g")
			.style("shape-rendering", "crispEdges");

		mouseRect = svg.append("rect")
			.style("fill-opacity", 0)
			.on("mousedown", xMousedownHandler)
			.on("mouseup", xMouseupHandler)
			.on("mousemove", xMousemoveHandler)
			.on("mouseout", xMouseoutHandler)
			.on("dblclick", dblclickHandler);

		// X axis
		xAxisClipRect = svg.append("clipPath")
			.attr("id", clipId + "-x")
			.append("rect");

		xAxisG = svg.append("g")
			.attr("clip-path", "url(#" + clipId + "-x)")
			.style("text-anchor", "middle");

		xMouseRect = svg.append("rect")
			.style("fill-opacity", 0)
			.on("mousedown", xMousedownHandler)
			.on("mouseup", xMouseupHandler)
			.on("mousemove", xMousemoveHandler)
			.on("mouseout", xMouseoutHandler)
			.on("dblclick", xDblclickHandler);

		// Y axis
		yAxisClipRect = svg.append("clipPath")
			.attr("id", clipId + "-y")
			.append("rect");

		yAxisG = svg.append("g")
			.attr("clip-path", "url(#" + clipId + "-y)")
			.style("text-anchor", "end");

		yMouseRect = svg.append("rect")
			.style("fill-opacity", 0)
			.on("mousedown", yMousedownHandler)
			.on("mouseup", yMouseupHandler)
			.on("mousemove", yMousemoveHandler)
			.on("mouseout", yMouseoutHandler)
			.on("dblclick", yDblclickHandler);

		// Lines
		linesG = graphG.append("g");

		// Error msg
		errorClipRect = graphG.append("clipPath")
			.attr("id", clipId + "-err")
			.append("rect");

		errorG = graphG.append("g")
			.attr("clip-path", "url(#" + clipId + "-err)");

		errorRect = errorG.append("rect")
			.style("fill", "rgba(255, 128, 128, 0.75)")
			.style("stroke", "#f00")
			.style("shape-rendering", "crispEdges");

		errorText = errorG.append("text")
			.style("fill", "#000")
			.style("text-anchor", "middle");
	}

	function redraw() {
		var innerWidth = S.width - S.marginLeft - S.marginRight,
			innerHeight = S.height - S.marginTop - S.marginBottom,
			x, y,
			scale,
			ticks,
			line,
			selection;

		svg
			.attr("width", S.width)
			.attr("height", S.height)
			.style("font-size", S.fontSize + "px")
			.style("font-family", S.fontFamily);

		x = S.marginLeft;
		y = S.marginTop;
		graphG
			.attr("transform", "translate("+ x + " " + y + ")");

		graphClipRect
			.attr("width", innerWidth)
			.attr("height", innerHeight);

		backgroundRect
			.attr("width", innerWidth)
			.attr("height", innerHeight)
			.attr("fill", S.backgroundColor);

		mouseRect
			.attr("x", x)
			.attr("y", y)
			.attr("width", innerWidth)
			.attr("height", innerHeight);

		// X axis

		scale = roundToHalf(S.xScale.range([0.5, innerWidth-0.5]));
		ticks = S.xScale.ticks(S.xGridLines);

		xAxisClipRect
			.attr("width", innerWidth)
			.attr("height", S.marginBottom);

		x = S.marginLeft;
		y = S.height - S.marginBottom;
		xAxisG
			.attr("transform", "translate(" + x + " " + y + ")")
			.style("fill", S.xLabelColor)

		xMouseRect
			.attr("x", x)
			.attr("y", y)
			.attr("width", innerWidth)
			.attr("height", S.marginBottom);

		// Grid
		selection = xGridG.selectAll("line").data(ticks);
		selection.exit().remove();
		selection.enter().append("line");
		selection
			.attr("x1", scale)
			.attr("y1", 0)
			.attr("x2", scale)
			.attr("y2", innerHeight)
			.style("stroke", S.xGridColor);

		// Labels
		selection = xAxisG.selectAll("g").data(ticks);
		selection.exit().remove();
		selection.enter().append("g");
		selection.selectAll("text").remove();
		selection.append("text")
			.attr("x", scale)
			.attr("y", 1.1*S.fontSize)
			.text(d3.time.format(S.xLabelFormat1));
		selection.append("text")
			.attr("x", scale)
			.attr("y", 2.2*S.fontSize)
			.text(d3.time.format(S.xLabelFormat2));

		// Y axis

		scale = roundToHalf(S.yScale.range([innerHeight-0.5, -0.5]));
		ticks = S.yScale.ticks(S.yGridLines);

		yAxisClipRect
			.attr("width", S.marginLeft)
			.attr("height", innerHeight);

		yAxisG
			.attr("transform", "translate(0 " + S.marginTop + ")")
			.style("fill", S.xLabelColor);

		yMouseRect
			.attr("y", S.marginTop)
			.attr("width", S.marginLeft)
			.attr("height", innerHeight);

		// Grid
		selection = yGridG.selectAll("line").data(ticks);
		selection.exit().remove();
		selection.enter().append("line");
		selection
			.attr("x1", 0)
			.attr("y1", scale)
			.attr("x2", innerWidth)
			.attr("y2", scale)
			.style("stroke", S.yGridColor);

		// Labels
		selection = yAxisG.selectAll("text").data(ticks);
		selection.exit().remove();
		selection.enter().append("text");
		selection
			.attr("x", S.marginLeft - 2)
			.attr("y", scale)
			.text(formatNumber);

		// Error message
		errorClipRect
			.attr("width", innerWidth - 2*S.fontSize)
			.attr("height", 2*S.fontSize);

		x = S.fontSize;
		y = innerHeight - 3*S.fontSize;
		errorG
			.attr("transform", "translate(" + x + " " + y + ")")
			.style("display", S.errorMsg == "" ? "none" : null);

		errorRect
			.attr("x", 0.5)
			.attr("y", 0.5)
			.attr("width", innerWidth - 2*S.fontSize - 1)
			.attr("height", 2*S.fontSize - 1);

		errorText
			.attr("x", innerWidth / 2)
			.attr("y", S.marginBottom - 1.15*S.fontSize)
			.text(S.errorMsg);

		// Lines
		line = d3.svg.line()
			.defined(function (d) {
				return isFinite(d);
			})
			.x(function (d, i) {
				return S.xScale(S.ts + (i + 0.5)*S.granularity);
			})
			.y(S.yScale);

		selection = linesG.selectAll("path").data(S.data);
		selection.enter().append("path");
		selection.exit().remove();
		selection
			.attr("d", line)
			.attr("fill", "none")
			.attr("stroke", function (d, i) {
				return typeof S.lineColors[i] != "undefined" ?
					S.lineColors[i] : "#000";
			})
			.attr("stroke-width", function (d, i) {
				return typeof S.lineWidths[i] != "undefined" ?
					S.lineWidths[i] : 1;
			});
	}

	// Event handlers

	function xMousedownHandler() {
		d3.event.preventDefault();
		if (S.xLocked) {
			return;
		}
		var xy = d3.mouse(d3.event.target);
		xAnchor = +S.xScale.invert(xy[0]);
		mouseRect.style("cursor", "ew-resize");
		xMouseRect.style("cursor", "ew-resize");
	}

	function xMouseupHandler() {
		xAnchor = null;
		mouseRect.style("cursor", null);
		xMouseRect.style("cursor", null);
	}

	function xMousemoveHandler() {
		var xy, t, d;
		if (xAnchor === null) {
			return null;
		}
		xy = d3.mouse(d3.event.target);
		t = +S.xScale.invert(xy[0]);
		d = S.xScale.domain();
		if (d3.event.shiftKey) {
			d[0] = +d[1] - (xAnchor - +d[1]) / (t - +d[1]) * (+d[1] - +d[0]);
		} else {
			d[0] = +d[0] + (xAnchor - t);
			d[1] = +d[1] + (xAnchor - t);
		}
		setters.xDomain(d);
		redraw();
	}

	function xMouseoutHandler() {
		var rtg = d3.event.relatedTarget;
		if (rtg != mouseRect[0][0] && rtg != xMouseRect[0][0]) {
			xAnchor = null;
			mouseRect.style("cursor", null);
			xMouseRect.style("cursor", null);
		}
	}

	function xDblclickHandler() {
		dispatch.xdblclick.call(_this);
	}

	function yMousedownHandler() {
		d3.event.preventDefault();
		if (S.yLocked) {
			return
		}
		var xy = d3.mouse(d3.event.target);
		yAnchor = S.yScale.invert(xy[1]);
		yMouseRect.style("cursor", "ns-resize");
	}

	function yMouseupHandler() {
		yAnchor = null;
		yMouseRect.style("cursor", null);
	}

	function yMousemoveHandler() {
		var xy, t, d;
		if (yAnchor === null) {
			return null;
		}
		xy = d3.mouse(d3.event.target);
		t = S.yScale.invert(xy[1]);
		d = S.yScale.domain();
		if (d3.event.shiftKey) {
			d[1] = d[0] + (yAnchor - d[0]) / (t - d[0]) * (d[1] - d[0]);
		} else {
			d[0] = d[0] + (yAnchor - t);
			d[1] = d[1] + (yAnchor - t);
		}
		setters.yDomain(d);
		redraw();
	}

	function yMouseoutHandler() {
		yAnchor = null;
		yMouseRect.style("cursor", null);
	}

	function yDblclickHandler() {
		dispatch.ydblclick.call(_this);
	}

	function dblclickHandler() {
		dispatch.dblclick.call(_this);
	}

	// Helper functions
	function roundToHalf(f) {
		return function (v) {
			return Math.round(f(v) - 0.5) + 0.5;
		};
	}

	function formatNumber(x) {
		var suffixes = "kMGTPEZY",
			sgn = x < -1 ? "-" : "",
			n = 1, ni, d, ds = "", fs, is, sfx = "",
			i;

		if (!isFinite(x)) {
			return "#";
		}
		x = Math.abs(x);
		for (i = 10; Math.round(10e3 * x / i) >= 10e3; i *= 10) {
			n++;
		}
		ni = (n - 2)%3 + 2;
		d = Math.round(10e3 * x / i);
		if (isNaN(d)) {
			return "#";
		}
		for (i = 0; i < 4; i++) {
			ds = ""+(d%10) + ds;
			d = (d - d%10) / 10;
		}
		is = ds.slice(0, ni);
		fs = ds.slice(ni);
		i = Math.floor((n - 2) / 3);
		if (i > 0) {
			sfx = i > suffixes.length ? "e"+(3*i) : suffixes[i-1];
		}
		return sgn + is + (+fs ? "." + fs : "") + sfx;
	}

	var coerce = {
		"int":     function (v) { return v|0;  },
		"str":     function (v) { return ""+v; },
		"num":     function (v) { return +v;   },
		"bool":    function (v) { return !!v;  },
		"int[]":   function (v) { return v.map ? v.map(coerce["int"]) : []; },
		"str[]":   function (v) { return v.map ? v.map(coerce["str"]) : []; },
		"num[]":   function (v) { return v.map ? v.map(coerce["num"]) : []; },
		"num[][]": function (v) { return v.map ? v.map(coerce["num[]"]) : []; }
	};

}
