"use strict";

var gulp = require("gulp");
var config = require("./gulp.config");

var clean = require('del');
var vinylPaths = require('vinyl-paths');
var uglify = require("gulp-uglify");
var minifyCSS = require("gulp-minify-css");
var minifyHTML = require("gulp-minify-html");
var sass = require("gulp-sass");
var concat = require("gulp-concat");
var jshint = require("gulp-jshint");
var csslint = require("gulp-csslint");
var newer = require("gulp-newer");
var gulpif = require("gulp-if");
var eventStream = require("event-stream");
var connect = require("gulp-connect");
var html2js = require("gulp-ng-html2js");
var imagemin = require('gulp-imagemin');
var pngcrush = require('imagemin-pngcrush');
var karma = require("karma").server;
var exec = require('child_process').exec;

gulp.task("default", ["watch"]);

gulp.task("build", ["html", "sass", "js", "vendor", "images"]);

gulp.task("watch", ["build"], function() {
	gulp.watch(config.html.watch, ["html"]);
	gulp.watch(config.sass.watch, ["sass"]);
	gulp.watch(config.js.watch, ["js"]);
});

gulp.task('images', ["clean"], function () {
	return gulp.src(config.images.src)
		.pipe(imagemin({
			progressive: true,
			svgoPlugins: [{removeViewBox: false}],
			use: [pngcrush()]
		}))
		.pipe(gulp.dest(config.images.dest));
});

gulp.task("clean", function() {
	return gulp.src(config.clean.src, { read: false })
		.pipe(vinylPaths(clean));
});

gulp.task("html", function() {
	return eventStream.merge(
		compileHtml(config.html.src, config.component.dest),
		compileHtml(config.html.demo, config.component.demo)
	);
});

gulp.task("sass", function() {
	return eventStream.merge(
		compileSass(config.sass.src, config.component.dest, config.component.name + ".css"),
		compileSass(config.sass.src, config.component.dest, config.component.name + ".min.css", true)
	);
});

gulp.task("js", function() {
	return eventStream.merge(
		compileJsAndMaybeHtml(
			config.js.src,
			config.component.dest,
			config.component.name + ".js"
		),
		compileJsAndMaybeHtml(
			config.js.src,
			config.js.dest,
			config.component.name + ".min.js",
			true
		),
		compileJsAndMaybeHtml(
			config.js.demo,
			config.js.demoSrc,
			config.component.demoJS
		)
	);
});

gulp.task("vendor", function() {
	return eventStream.merge(
		compileJsAndMaybeHtml(config.vendor.js, config.vendor.dest, "vendor.js", true, false),
		gulp.src(config.vendor.css)
			.pipe(concat("vendor.css"))
			.pipe(gulp.dest(config.vendor.dest)),
		gulp.src(config.vendor.fonts)
			.pipe(gulp.dest(config.vendor.dest + "/fonts"))
	);
});

gulp.task("server", function() {
	connect.server({
		port: config.server.port,
		root: config.server.root
	});
});

gulp.task("e2e-test", ["server"], function(done) {
	exec("protractor protractor.conf.js", function(err, stdout) {
		console.log(stdout);
		connect.serverClose();
		done();
	});
});

gulp.task("unit-test", function(done) {
	return karma.start({
		configFile: __dirname + "/karma.conf.js",
		singleRun: true
	}, done);
});

//common functions
function compileHtml(source, destination) {
	//we will always minify html because the dev console will prettify it
	return gulp.src(source)
		.pipe(newer(config.component.dest))
		.pipe(minifyHTML({empty: true, spare: true}))
		.pipe(gulp.dest(destination));
}

function compileSass(source, destination, concatName, minify, hideErrors) {
	return gulp.src(source)
		.pipe(sass())
		.pipe(csslint("csslintrc.json"))
		.pipe(gulpif(hideErrors, csslint.reporter()))
		.pipe(gulpif(minify, minifyCSS()))
		.pipe(concat(concatName))
		.pipe(gulp.dest(destination));
}

function compileJsAndMaybeHtml(source, destination, concatName, minify, hideErrors) {
	return gulp.src(source)
		.pipe(gulpif(/[.]html$/, minifyHTML({
			empty: true,
			quotes: true,
			spare: true
		})))
		.pipe(gulpif(/[.]html$/, html2js({
			moduleName: config.component.moduleName,
			prefix: config.component.prefix
		})))
		.pipe(jshint())
		.pipe(gulpif(hideErrors, jshint.reporter("default")))
		.pipe(gulpif(minify, uglify({mangle: false})))
		.pipe(concat(concatName))
		.pipe(gulp.dest(destination));
}