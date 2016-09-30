
var request = require('request');
function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

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

var zipcode = 6060;
if (zipcode) 
{
	if(/(^\d{5}$)/.test(zipcode))
	{
		GetStores(zipcode,function(json)
		{
			if(json.error || json.stores.length == 0)
			{
				console.log("Okay, I understood you were looking for stores in "+zipcode+". However, I couldn't find any stores at this time for that location.");
			}
			else
			{
				var storeList = "";
				var city = "";
				var count = 0;
				json.stores.forEach(function(store)
				{
					var number = store.stnm,
						address = toTitleCase(store.stadd),
						time = "It opens at "+store.storeOpenTime+" and Closes at "+store.storeCloseTime,
						msg = "Store "+number+", at "+address+". "+time+". ";
					storeList = storeList + msg;
					city = toTitleCase(store.stct);
					count++;
					console.log(count+"=="+json.stores.length);
					if(count == json.stores.length)
					{
						console.log(storeList.length);
						if(city != "")
							console.log("Oh, I love "+city+"! I found "+json.stores.length+" stores. "+storeList+", checkout the Alexa app for more information!");
						else
							console.log("Okay, I found "+json.stores.length+" stores. "+storeList+", checkout the Alexa app for more information!");
					}
				});
			}
		});
	}
	else
	{
		console.log("Sorry...I only heard "+zipcode+" can you try saying the zipcode again?");
	}
}
else
{
	console.log("What is your zipcode?");
}