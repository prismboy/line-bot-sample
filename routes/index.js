/**
 * LINE BOT : ルーティング
 *
 * @module routes/index
 * @author Ippei SUZUKI
 * @author Yoshihiko Akamatsu (modified by)
 */

// モジュールを読込む。
var context = require('../utils/context');
var crypto = require("crypto");

// LINE BOT API を呼出す。
var callLineBotApi = function (options, callback) {
    context.request(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            callback(body, response);
        } else {
            console.log('error: ' + JSON.stringify(error));
            console.log('response: ' + JSON.stringify(response));
        }
    });
};

// テキストメッセージを送信する。
var pushMsg = function (text, event) {
    // 送信データを作成する。
    var data = {
        "to": event.source.userId,
        "messages": [
            {
                "type": "text",
                "text": text
            },
            {
                "type": "sticker",
                "packageId": "1",
                "stickerId": "13"
            }
        ]
    };

    //オプションを定義する。
    var options = {
        method: 'POST',
        url: 'https://api.line.me/v2/bot/message/push',
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.CHANNEL_ACCESS_TOKEN
        },
        json: true,
        body: data
    };

    // LINE BOT API: Sending messages (Text)
    callLineBotApi(options, function (body) {
        console.log(body);
    });
};


// Header 文字列からファイル名を取得する。
var getFilename = function (contentType, reqId) {
    return reqId + "." + contentType.replace("image\/","");
};

// 解析不可時のメッセージ
var cantRecognize = function (event) {
    var data = {
        "to": event.source.userId,
        "messages": [
            {
                "type": "text",
                "text": "申し訳ありません。\n解析できませんでした。"
            },
            {
                "type": "sticker",
                "packageId": "1",
                "stickerId": "107"
            }
        ]
    };

    //オプションを定義する。
    var options = {
        method: 'POST',
        url: 'https://api.line.me/v2/bot/message/push',
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.CHANNEL_ACCESS_TOKEN
        },
        json: true,
        body: data
    };

    // LINE BOT API: Sending messages (Text)
    callLineBotApi(options, function (body) {
        console.log(body);
    });
};

// リクエストがLINE Platformから送信されたものであるかを検証する
var verifyRequest = function(request) {
// todo 実装を見直す
    var key = request.headers['X-Line-Signature'];
    var hmac = crypto.createHmac('sha512', key);
    hmac.update(request.body);
    return hmac.digest('base64') === key;
};

// 画像認識
var recognize = function (event) {
    var id = event.message.id;
    // 送信オプションを定義
    var options = {
        "method": "GET",
        "url": 'https://api.line.me/v2/bot/message/' + id + '/content',
        "encoding": null,
        "headers": {
            "Authorization": "Bearer " + process.env.CHANNEL_ACCESS_TOKEN
        }
    };

    // LINE BOT API: Getting message content
    callLineBotApi(options, function (body, response) {
        console.log('response: ' + JSON.stringify(response.headers));
        // イメージファイルを保存する。 (Visual Recognitionに直接バイナリファイルを渡せないため)
        var filename = '../tmp/' + getFilename(response.headers['content-type'], response.headers['x-line-request-id']);
        context.fs.writeFileSync(filename, body);
        // Visual Recognition Detect faces
        if (context.appSetting.recognizeMode === 'detectFaces'){
            pushMsg("顔を認識中です", event);
            context.visualRecognition.detectFaces({
                images_file: context.fs.createReadStream(filename)
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
                    cantRecognize(event);
                } else {
                    var msg = "";
                    var faces = response.images[0].faces;

                    for(var i=0;i<faces.length;i++){
                        if(msg !== "") msg += "\n";
                        msg = msg + "性別 : " + faces[i].gender.gender + " (" + faces[i].gender.score + ")\n";
                        msg += "年齢 : ";
                        if(faces[i].age.min != undefined) {
                             msg += faces[i].age.min;
                        }
                        msg += "-";
                        if(faces[i].age.max != undefined) {
                            msg += faces[i].age.max;
                        }
                        msg += " (" + faces[i].age.score + ")\n";
                        if(faces[i].identity != undefined){
                            msg = msg + "名前 : " + faces[i].identity.name + " (" + faces[i].identity.score + ")";
                        }
                    }
                    if(msg===""){
                        cantRecognize(event);
                    } else {
                        pushMsg(msg,event);
                    }
                }
            });
        } else {
            pushMsg("画像を分類中です", event);
            context.visualRecognition.classify({
                images_file: context.fs.createReadStream(filename),
                classifier_ids: process.env.CLASSIFIER_IDS
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
                    cantRecognize(event);
                } else {
                    var classifiers = response.images[0].classifiers;
                    var msg = "";
                    for(var i=0;i<classifiers.length;i++){
                        var classes = classifiers[i].classes;
                        for(var j=0;j<classes.length;j++){
                            if(msg!==""){ msg += "\n"; }
                            msg += classes[j].class + " (" + classes[j].score + ")";
                        }
                    }
                    if(msg===""){
                        cantRecognize(event);
                    } else {
                        pushMsg(msg,event);
                    }
                }
            });
        }
    });
};


var textCmd = function (event) {
    if (event.message.text.toLowerCase().indexOf('help') > -1){
        pushMsg('cmdのリスト\n' +
            'current - 現在のモードを表示\n' +
            'mode:f - 顔認識モード\n' +
            'mode:c - 分類認識モード', event);
    } else if (event.message.text.toLowerCase().indexOf('current') > -1){
        pushMsg(JSON.stringify(context.appSetting), event);
    } else if (event.message.text.toLowerCase().indexOf('mode:f') > -1){
        context.appSetting.recognizeMode = 'detectFaces';
        pushMsg(JSON.stringify(context.appSetting), event);
    } else if (event.message.text.toLowerCase().indexOf('mode:c') > -1){
        context.appSetting.recognizeMode = 'classify';
        pushMsg(JSON.stringify(context.appSetting), event);
    } else {
        pushMsg("cmd:helpでコマンドを確認してください",event);
    }
};


/** LINE から呼び出されるコールバック */
exports.callback = function (req, res) {
    // リクエストがLINE Platformから送信されたものか検証する。
    if ( !verifyRequest ) {
        console.log('検証エラー: 不正なリクエストです。');
        pushMsg('検証エラー: 不正なリクエストです。');
        return;
    }

    // ref https://developers.line.me/bot-api/api-reference#receiving_messages
    if (req.body.events === undefined){
        res.sendStatus(500);
        return;
    }

    var event = req.body.events[0];
    if (event.message.type === "text") {
        // text
        if (event.message.text.toLowerCase().indexOf('cmd:') > -1) {
            textCmd(event);
        } else {
            pushMsg('会話は今勉強中だからちょっと待って', event);
        }
    } else if (event.message.type === "image") {
        // images
        recognize(event);
    } else {
        //other
        pushMsg('写真を送ってください。', event);
    }
};

exports.index = function(req, res){
    res.sendStatus(200);
};
