//initialize express
var express = require('express');
//initialize alexa-app
var alexa = require('alexa-app');
var request = require('request');
//initialize the app and set the port
var app = express();
//verifier to make sure our certs come from Amazon
var verifier = require('alexa-verifier');

app.set('port', (process.env.PORT || 5000));
app.use(express.static('public'));
app.set('view engine','ejs');

app.use(function(req, res, next) {
	if (!req.headers || !req.headers.signaturecertchainurl) {
		return next();
	}

	req._body = true;
	req.rawBody = '';
	req.on('data', function(data) {
		return req.rawBody += data;
	});
	return req.on('end', function() {
		var cert_url, er, requestBody, signature;
		try {
			req.body = JSON.parse(req.rawBody);
		} catch (_error) {
			er = _error;
			req.body = {};
		}
		cert_url = req.headers.signaturecertchainurl;
		signature = req.headers.signature;
		requestBody = req.rawBody;
		return verifier(cert_url, signature, requestBody, function(er) {
			if (er) {
				console.error('error validating the alexa cert:', er);
				return res.status(401).json({
					status: 'failure',
					reason: er
				});
			} else {
				return next();
			}
		});
	});
});


//what we say when we can't find a valid response
var failedSpeechRequest = "Sorry, I can not help you with that right now. Please try again.";

//create and assign our Alexa App instance to an address on express, in this case https://.../api/wag-skill
var alexaApp = new alexa.app('wag-skill');
alexaApp.express(app, "/api/");

//make sure our app is only being launched by the correct application (our Amazon Alexa app)
alexaApp.pre = function(request,response,type) {
	//console.log(JSON.stringify(request,null,2));
	if (request.sessionDetails.application.applicationId != "amzn1.echo-sdk-ams.app.cd6751dd-34e8-458e-bb55-50eba8845961") {
		// Fail ungracefully 
		response.fail("Invalid applicationId");
	}
};
alexaApp.post = function(request,response,type,exception) 
{
	//console.log(JSON.stringify(response,null,2));
	if(exception)
		response.clear().say("An error occured: "+exception).send();
};

//our intent that is launched when "Hey Alexa, open Walgreens" command is made
alexaApp.launch(function(request,response)
{
	//log our app launch
	console.log("Alexa Skill launched"); 
	
	var speechText = "Welcome to Walgreens. What can we help you with.";
	response.say(speechText).shouldEndSession(false);
});

alexaApp.intent('AMAZON.CancelIntent',{
		//define our custom variables, in this case, none
        "slots" : {},
		//define our utterances, we're saying goodbye
        "utterances" : ["{Exit|Thank you|Goodbye|Close}"]
    },
    function(request, response){
		//say "goodbye"
		response.say("Alright. We hope to see you soon! Just say: 'Alexa start Walgreens'").shouldEndSession(true);
});

alexaApp.intent('AMAZON.StopIntent',{
		//define our custom variables, in this case, none
        "slots" : {},
		//define our utterances, we're saying goodbye
        "utterances" : ["{Exit|Thank you|Goodbye|Close}"]
    },
    function(request, response){
		//say "goodbye"
		response.say("Alright. We hope to see you soon! Just say: 'Alexa start Walgreens'").shouldEndSession(true);
});

alexaApp.intent('AMAZON.HelpIntent',{
		//define our custom variables, in this case, none
        "slots" : {},
		//define our utterances, we're saying help!
        "utterances" : ["{Help|Help me|Explain to the team}"]
    },
    function(request, response)
    {
		var speechText = "Hello, I am Alexa! I'm a very smart home device, and with Walgreens you have the ability to obtain any number of things to make your shopping experience easier. You can ask me questions like: what is the nearest store? or Can I get a beauty tip? ... Now, what can I help you with?";
		response.say(speechText).shouldEndSession(false);
	}
);

alexaApp.intent('GetStoreInfo',{
		//define our custom variables, in this case, none
        "slots" :{"ZIPCODE": "AMAZON.NUMBER"},
		//define our utterances, we're asking for a beautytip
        "utterances" : ["{what's the nearest|what is the nearest|what is the|what are the|what's the|when does| when does the|} {store|} {hours|info|information|open|close|} {for|} {-|ZIPCODE}"]
    }, 
    function(request, response)
    {
	    var zipcode = request.slot('ZIPCODE'); 
		if (zipcode) 
		{
			if(/(^\d{5}$)/.test(zipcode))
			{
				console.log("Looking up stores in "+zipcode+"...");
				GetStores(zipcode,function(json)
				{
					if(json.error || json.stores.length == 0)
					{
						response.say("Okay, I understand you were looking for stores in "+zipcode+". However, I couldn't find any stores at this time for that location.");
					}
					else
					{
						console.log("Found "+json.stores.length+" stores!");
						var stores = [],
							storesList = "",
							markerList = "";
						json.stores.forEach(function(store)
						{
							var s = {};
							s.number = store.stnm;
							s.lat = store.stlat;
							s.lng = store.stlng;
							s.address = toTitleCase(store.stadd);
							s.time = "Open: "+store.storeOpenTime+" till "+store.storeCloseTime;
							s.city = toTitleCase(store.stct);
							s.msg = "Store #"+s.number+", at "+s.address+".\n "+s.time+".\n\n";
							storesList = storesList + s.msg;
							markerList = markerList+s.lat+"%2C"+s.lng+"%7C";
							stores.push(s);
						});
						
						var city = stores[0].city,
							storeInfo = "Store number<say-as interpret-as='digits'>"+stores[0].number+"</say-as>, at <say-as interpret-as='address'>"+stores[0].address+"</say-as>. It is "+stores[0].time;
						if(city != "")
							response.say("Oh, "+getEmotion()+" "+city+"! I found "+stores.length+" stores. The closest one is: "+storeInfo+". I added a card with more information in the Alexa app!").send();
						else
							response.say("Okay, I found "+stores.length+" stores. The closest one is: "+storeInfo+". I added a card with more information in the Alexa app!").send();
						
						response.card({
							type: "Standard",
							title: "Walgreens Stores: "+zipcode, 
							text:  storesList+"\n\n\nLearn more here: https://www.google.com/maps/place/Walgreens+"+zipcode
/*
							image: {
								smallImageUrl: "https://wag-skill.herokuapp.com/smallmap.png", //"https://maps.googleapis.com/maps/api/staticmap?size=720x480&zoom=14&markers=label:W%7Ccolor:red%7C"+zipcode+"%7C"+markerList,  //One must be specified 
								largeImageUrl: "https://wag-skill.herokuapp.com/largemap.png" //"https://maps.googleapis.com/maps/api/staticmap?size=1200x800&zoom=14&markers=label:W%7Ccolor:red%7C"+zipcode+"%7C"+markerList
							}
*/
						});
					}
				});
				return false;
			}
			else
			{
				response.say("Sorry...I only heard <say-as interpret-as='digits'>"+zipcode+"</say-as> can you try saying the zipcode again?").reprompt("I need your zipcode to find the stores near your location.").shouldEndSession(false);
			}
	    }
		else
		{
			response.say("What is your zipcode?").reprompt("I need your zipcode to find the stores near your location.").shouldEndSession(false);
		}
	}
);

var GetStores = function(zipcode,callback)
{
	var options = {
		method: 'POST',
		url: 'https://services-qa.walgreens.com/api/stores/search',
		headers: { 'Content-Type': 'application/json' },
		body: {			
			apiKey: "A2829hACUIhF4QIvTwbIvD1zA6dG9m0i",
            affId: "extest1",
            act: 'fndStore',
            view: 'fndStoreJSON',
            requestType: 'locator',
            addr: zipcode,
            srchOpt: '',
            devinf: 'AmazonEcho,1.0',
            appver: '1.0'
		},
		json: true 
	};
	//console.log(options);
	request(options, function(err,response,body)
	{
		if(!err && response.statusCode == 200)
		{
			if(body.err || body.errCode)
				callback({error:(body.err || body.errCode)});
			else
				callback(body);
		}
		else
			callback({error:err});
	});
};

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

alexaApp.intent('GiveBeautyTip',{
		//define our custom variables, in this case, none
        "slots" : {},
		//define our utterances, we're asking for a beautytip
        "utterances" : ["{whats a|what is a|give me a|can i have|tell me a|} beauty tip"]
    },
    function(request, response)
    {
		var tip = getBeautyTip();
		if(tip == "")
			tip = failedSpeechRequest;
			
		response.say(tip).shouldEndSession(true);
	}
);

var getBeautyTip = function()
{
	var length = beautyTips.length;
	var number = Math.floor(Math.random() * length);
	var tip = beautyTips[number];
	return "Absolutely! "+tip;
};
var getEmotion = function()
{
	var length = emotions.length;
	var number = Math.floor(Math.random() * length);
	var emotion = emotions[number];
	return emotion;
};

app.get('/',function(request,response)
{
	response.render("index.ejs");
});
//a shortcut to get our app schema
app.get('/schema', function(request, response) {
    response.send('<pre>'+alexaApp.schema()+'</pre>');
});

//a shortcut to get our app utterances
app.get('/utterances', function(request, response) {
    response.send('<pre>'+alexaApp.utterances()+'</pre>');
});

//make sure we're listening on the assigned port
app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});
var emotions = ["","I love","I have never been to","I like","I have a funny story about","I adore","I just went on vacation to","My family lives in"];
var beautyTips = ["Are you one of those terribly talented, and always-in-a-rush, girls who can do their make-up meticulously! Checkout the glam-on-the-go COMMUTER KIT of wonder-stuffs to get you from stressed to fresh when you travel from A to B.",
"The No. 1 rule of wedding etiquette. Don’t upstage the bride! Check out our top products for a SUBTLE and sophisticated wedding guest look that will see you through the weepy vows and the wild dancing.",
"Try this lip-lovin’ trick for a more stand-out pout. Use two contrasting SEXY MOTHER PUCKER lipstick shades, try RED & BERRIED with FUSCHIA PROOF, and a dab of our GLOW ALL OUT Highlight & Sculpt Cheek Stick across your cupid's bow for 4D fulsomeness.",
"Who’s having a girly gathering or a family BBQ? Whatever you’re up to, our super-sassy bright lip colors will complete your good-time glam look. Shop our Soap and Glory Sexy Mother Pucker Lipstick Collection.",
"YOU GLOW GIRL! Create a flawless rosy glow instantly with our BRAND NEW blendable, rich and creamy MADE YOU BLUSH in three cheeky shades.",
"Before trying any new lip look, make sure your lips are smooth and soft. Lightly scrub them with a soft damp toothbrush to get rid of any dry skin before applying make-up.",
"There are two rules when it comes to blending. First, you can never blend too much. Second, apply your make-up in gradual layers - you can always add more, but removing it is trickier.",
"Make like Joan Collins and sleep on a satin pillowcase. It creates less friction than a cotton one, which means your hair won’t tangle or break when you toss and turn during the night.",
"Did you know we should only wash our hair twice a week? Any more will leave hair too dry or too oily, as you’re washing away the natural oils.",
"Come rain or shine, applying a broad-spectrum sunscreen that contains both UVA and UVB protection every day is the single most important thing you can do to prevent sun damage and further skin ageing. Look for sunscreens that have five stars as they offer the highest level of UVA protection.",
"The Rightous Butter Created by our friends at Soap and Glory has a secret body moisturizing formula It is so virtuous you might swear you're wearing velvet. Not only that but it is on sale for $15.00!",
"If you're prone to redness, you can use the Number7 Colour Correcting Cream. The cream provides great coverage while helping to even the skin tone and counteract red or dull skin. Did I mention it is on sale for $10.00?",
"Didn't get much sleep? Use Number7 Instant Radiance concealer to banish dark under eye circles. Dab gently around the eyes with your ring finger, for a bright-eyed and bushy-tailed look. People will ask:Did you get your beauty sleep? You can say: Who, me!? Of course!"];


