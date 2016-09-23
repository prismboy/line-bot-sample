/**
 * LINE BOT : ルーティング
 *
 * @module routes/index
 * @author Ippei SUZUKI
 */

// モジュールを読込む。
var context = require('../utils/context');

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
        'to': [content.from],
        "toChannel": 1383378250,
        "eventType": "138311608800106203",
        "content": {
            "contentType": 1,
            "toType": 1,
            "text": text
        }
    };

    //オプションを定義する。
    var options = {
        method: 'POST',
        url: 'https://trialbot-api.line.me/v1/events',
        proxy: context.staticaUrl,
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
    var temp = contentDisposition.match(/^attachment; filename=\"(.*)\"$/);
    return temp ? temp[1] : 'default';
}

// 解析不可時のメッセージ
var cantRecognize = function (content) { sendText("申し訳ありません。\n解析不能です", content); }

// 画像認識
var visualRecognition = function (content) {
    var id = content.id;
    // 送信データ作成
    var data = {
        'to': [content.from],
        "toChannel": 1383378250,
        "eventType": "138311608800106203",
        "content": {
            "toType": 1,
            "createdTime": 1448616197774,
            "from": "u90efb18b1449b80dfe176e490058124a",
            "location": null,
            "id": id,
            "to": ["u9a1701809838503fc3f9a7048d819ccf"],
            "text": "",
            "contentMetadata": null,
            "deliveredTime": 0,
            "contentType": 2,
            "seq": null
        },
        "createdTime": 1448616198606,
        "eventType": "138311609000106303",
        "from": "uefb896062d34df287b220e7b581d24a6",
        "fromChannel": 1341301815,
        "id": "ABCDEF-12345678901",
        "to": ["uaf73f6500f6bd2e8f1697782c042420d"],
        "toChannel": 1441301333
    };

    //オプションを定義
    var options = {
        url: 'https://trialbot-api.line.me/v1/bot/message/' + id + '/content',
        encoding: null,
        proxy: context.staticaUrl,
        headers: context.headers,
        json: true
    };

    // LINE BOT API: Getting message content
    callLineBotApi(options, function (body, response) {
        // イメージファイルを保存する。 (Visual Recognitionに直接バイナリファイルを渡せないため)
        var filename = '../tmp/' + getFilename(response.headers['content-disposition']);
        context.fs.writeFileSync(filename, body);
        // Visual Recognition Detect faces
        if (context.appSetting.recognizeMode === 'detectFaces'){
            sendText('顔写真を解析します', content);
            context.visualRecognition.detectFaces({
                images_file: context.fs.createReadStream(filename)
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
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
            sendText('何が写ってるか解析します', content);
            context.visualRecognition.classify({
                images_file: context.fs.createReadStream(filename)
            }, function (err, response) {
                if (err) {
                    console.log('error: ' + err);
                } else {
                    var classifiers = response.images[0].classifiers;
                    var msg = "";
                    for(var i=0;i<classifiers.length;i++){
                        var classes = classifiers[i].classes;
                        for(var j=0;j<classes.length;j++){
                            if(msg!=""){ msg += "\n"; }
                            if(classifiers[i].classifier_id == "default") {
                                msg += classes[j].class + " (" + classes[j].score + ")";
                            } else {
                                msg += classifiers[i].name + " (" + classes[j].score + ")";
                            }
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
    if (content.text.toLowerCase().indexOf('help') > -1){
        sendText('cmdのリスト\n' +
            'showSetting - 現在のモードを表示\n' +
            'mode:f - 顔認識モード\n' +
            'mode:c - 分類認識モード', content);
    } else if (content.text.toLowerCase().indexOf('showsetting') > -1){
        sendText(JSON.stringify(context.appSetting), content);
    } else if (content.text.toLowerCase().indexOf('mode:f') > -1){
        context.appSetting.recognizeMode = 'detectFaces';
        sendText(JSON.stringify(context.appSetting), content);
    } else if (content.text.toLowerCase().indexOf('mode:c') > -1){
        context.appSetting.recognizeMode = 'classify';
        sendText(JSON.stringify(context.appSetting), content);
    } else {
        sendText("cmd:helpでコマンドを確認してください",content);
    }
};


/** LINE から呼び出されるコールバック */
exports.callback = function (req, res) {
    // ref https://developers.line.me/bot-api/api-reference#receiving_messages
    var content = req.body.result[0].content;
    console.log('callback: ' + content.conte);
    if (content.contentType == 1) {
        // text
        if (content.text.toLowerCase().indexOf('cmd:') > -1) {
            textCmd(content);
        } else {
            sendText('会話は今勉強中だからちょっと待って', content);
        }
    } else if (content.contentType == 2) {
        // images
        sendText('解析中です。', content);
        visualRecognition(content)
    } else {
        //other
        sendText('顔写真を送ってください。', content);
    }
};