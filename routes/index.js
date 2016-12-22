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
        if (!error && response.statusCode == 200) {
            callback(body, response);
        } else {
            console.log('error: ' + JSON.stringify(error));
            console.log('response: ' + JSON.stringify(response));
        }
    });
};

// テキストメッセージを送信する。
var sendText = function (text, content) {
    // 送信データを作成する。
    var data = {
        'replyToken': content.replyToken,
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
        url: 'https://api.line.me/v2/bot/message/reply',
        // proxy: context.staticaUrl,
        headers: context.headers,
        json: true,
        body: data
    };

    // LINE BOT API: Sending messages (Text)
    callLineBotApi(options, function (body) {
        console.log(body);
    });
};


// Header 文字列からファイル名を取得する。
var getFilename = function (contentDisposition) {
    var temp;
    if(contentDisposition===undefined){
        console.log("response.header 'content-disposition' is undefined!");
    } else {
        temp = contentDisposition.match(/^attachment; filename=\"(.*)\"$/);
    }
    return temp ? temp[1] : 'default';
}

// 解析不可時のメッセージ
var cantRecognize = function (content) {
    var data = {
        'replyToken': content.replyToken,
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
        url: 'https://api.line.me/v2/bot/message/reply',
        // proxy: context.staticaUrl,
        headers: context.headers,
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
}

// 画像認識
var visualRecognition = function (content) {
    var id = content.message.id;
    // 送信オプションを定義
    var options = {
        "method": "GET",
        "url": 'https://api.line.me/v2/bot/message/' + id + '/content',
        "encoding": null,
        // "proxy": context.staticaUrl,
        "headers": {"Authorization": "Bearer " + process.env.CHANNEL_ACCESS_TOKEN}
    };

    // LINE BOT API: Getting message content
    callLineBotApi(options, function (body, response) {
        // イメージファイルを保存する。 (Visual Recognitionに直接バイナリファイルを渡せないため)
        var filename = '../tmp/' + getFilename(response.headers['content-disposition']);
        context.fs.writeFileSync(filename, body);
        // Visual Recognition Detect faces
        if (context.appSetting.recognizeMode === 'detectFaces'){
            context.visualRecognition.detectFaces({
                images_file: context.fs.createReadStream(filename)
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
                    cantRecognize(content);
                } else {
                    var msg = "";
                    var faces = response.images[0].faces;

                    for(var i=0;i<faces.length;i++){
                        if(msg != "") msg += "\n";
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
                    if(msg==""){
                        cantRecognize(content);
                    } else {
                        sendText(msg,content);
                    }
                }
            });
        } else {
            context.visualRecognition.classify({
                images_file: context.fs.createReadStream(filename),
                classifier_ids: process.env.CLASSIFIER_IDS
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
                    cantRecognize(content);
                } else {
                    var classifiers = response.images[0].classifiers;
                    var msg = "";
                    for(var i=0;i<classifiers.length;i++){
                        var classes = classifiers[i].classes;
                        for(var j=0;j<classes.length;j++){
                            if(msg!=""){ msg += "\n"; }
                            msg += classes[j].class + " (" + classes[j].score + ")";
                        }
                    }
                    if(msg==""){
                        cantRecognize(content);
                    } else {
                        sendText(msg,content);
                    }
                }
            });
        }
    });
};


var textCmd = function (content) {
    if (content.message.text.toLowerCase().indexOf('help') > -1){
        sendText('cmdのリスト\n' +
            'current - 現在のモードを表示\n' +
            'mode:f - 顔認識モード\n' +
            'mode:c - 分類認識モード', content);
    } else if (content.message.text.toLowerCase().indexOf('current') > -1){
        sendText(JSON.stringify(context.appSetting), content);
    } else if (content.message.text.toLowerCase().indexOf('mode:f') > -1){
        context.appSetting.recognizeMode = 'detectFaces';
        sendText(JSON.stringify(context.appSetting), content);
    } else if (content.message.text.toLowerCase().indexOf('mode:c') > -1){
        context.appSetting.recognizeMode = 'classify';
        sendText(JSON.stringify(context.appSetting), content);
    } else {
        sendText("cmd:helpでコマンドを確認してください",content);
    }
};


/** LINE から呼び出されるコールバック */
exports.callback = function (req, res) {
    // リクエストがLINE Platformから送信されたものか検証する。
    if ( !verifyRequest ) {
        console.log('検証エラー: 不正なリクエストです。');
        sendText('検証エラー: 不正なリクエストです。');
        return;
    }

    // ref https://developers.line.me/bot-api/api-reference#receiving_messages
    var content = req.body.events[0];
    if (content.message.type == "text") {
        // text
        if (content.message.text.toLowerCase().indexOf('cmd:') > -1) {
            textCmd(content);
        } else {
            sendText('会話は今勉強中だからちょっと待って', content);
        }
    } else if (content.message.type == "image") {
        // images
        visualRecognition(content)
    } else {
        //other
        sendText('写真を送ってください。', content);
    }
};