/**
 * LINE BOT: コンテキスト
 *
 * @module utils/context
 * @author Ippei SUZUKI
 */

// 環境変数を取得する。
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();

/** 環境変数 */
exports.appEnv = appEnv;

/** File System */
exports.fs = require('fs');

/** Path */
exports.path = require('path');

/** Request */
exports.request = require('request');

/** STATICA URL */
var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
// var staticaName = vcapServices.statica[0].name;
// var staticaCreds = appEnv.getServiceCreds(staticaName);
// exports.staticaUrl = staticaCreds.STATICA_URL;

/** Watson Visual Recognition */
// ref https://github.com/watson-developer-cloud/node-sdk
var watson = require('watson-developer-cloud');
var visualRecognitionName = vcapServices.watson_vision_combined[0].name;
var visualRecognitionCreds = appEnv.getServiceCreds(visualRecognitionName);
// console.log("API KEY: "+visualRecognitionCreds.api_key);
// console.log("VisualRecognitionName: "+visualRecognitionName);
var visualRecognition = watson.visual_recognition({
    api_key: visualRecognitionCreds.api_key,
    version: 'v3',
    version_date: '2016-05-20',
    headers : {
        'Accept-Language': 'en'
    }
});
exports.visualRecognition = visualRecognition;

/** LINE BOT API Header */
exports.headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env.CHANNEL_ACCESS_TOKEN
};

/**
 * classify, detectFaces
 */
exports.appSetting = {
    recognizeMode : 'classify'
}
