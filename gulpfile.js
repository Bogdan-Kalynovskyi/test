var gulp = require('gulp'),
    //watch = require('gulp-watch'),
    concat = require('gulp-concat');


//script paths
var sourceDir = 'src/*.js',
    compiledDir = 'include/';


gulp.task('default', function() {
    return gulp
        .src(sourceDir)
        // .pipe(watch(sourceDir))// todo: compiles on start
        .pipe(concat('qstatistics.js'))
        .pipe(gulp.dest(compiledDir));
});

