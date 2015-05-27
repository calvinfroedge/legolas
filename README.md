# Legolas - Elegant OAuth On Top of Express, Passport, Sessions, Sockets
<img src="http://cliparts.co/cliparts/8cx/n5d/8cxn5dX9i.png" width="250" />

## Why?
Integrating with the other apps your customers use is one of the most common use cases for modern web apps. Most of the time, that happens via OAuth. **Legolas builds on existing tools to provide a secure, easy, and user friendly way to do that.**

While Passport does a great job of giving you the tools to build your authentication system on top of an OAuth provider, you still need to do the work yourself to build out a consistent, user friendly way of handling integrations securely. Legolas aims to make this as simple as entering a few parameters into a configuration variable for any provider that implements the OAuth 1.0 (deprecated, I know, but it's still being used) or 2.0 specifications.

**While Passport gives hundreds of integrations, they're designed to be authentication strategies rather than integration strategies. Legloas is focused on integration, and builds on Passport.**

Legolas makes it super simple to add integrations, give updates to your client via a web socket with Engine.io when OAuth completes without interrupting flow, and define what should happen when OAuth completes. For a video demo, click below:

<a href="https://www.youtube.com/watch?v=l_LaMguBvXs&feature=youtu.be" target="_blank"><img src="http://img.youtube.com/vi/l_LaMguBvXs/0.jpg" /></a>

## How?
- Each integration you add to your configuration file adds 2 routes to express, such as `/oauth/2.0/mailchimp` and `/oauth/2.0/mailchimp/callback`
- When a new client connects to your app, a socket connection is established and the id of that socket connection is set in the user's session.
- When a user visits the first route, the OAuth process is handled. It is expected you'll do this in a new tab or via an iframe. Your client code / app state / url will not be affected.
- When the OAuth is complete, a socket noficiation is sent from the server to the client, and the session is updated.

## Disclaimers

- You'll need to deal with how you store / interact with OAuth details once you get them (for now, anyway)
- It's a good idea to think about the memory implications of storing session and socket data. Consider using Redis or similar for session storage.

## Example configuration file

```
{
  "1.0": {
    "aweber": [
      "https://auth.aweber.com/1.0/oauth/request_token", 
      "https://auth.aweber.com/1.0/oauth/access_token", 
      "https://auth.aweber.com/1.0/oauth/authorize",
      "CONSUMER_KEY",
      "CONSUMER_SECRET"
    ]
  },
  "2.0": {
    "mailchimp": [
      "https://login.mailchimp.com/oauth2/authorize",
      "https://login.mailchimp.com/oauth2/token",
      "CLIENT_ID",
      "CLIENT_SECRET"
    ]
  }
}
```

Notice that this follows the pattern of `REQUEST_TOKEN_URL`, `ACCESS_TOKEN_URL`, `AUTHORIZE_URL`, `CONSUMER_KEY`, `CONSUMER_SECRET` for OAuth 1.0, and `AUTHORIZE_URL`, `TOKEN_URL`, `CLIENT_ID`, `CLIENT_SECRET` for OAuth 2.0.

Additionally, extra param can be passed to both implementations as an object, which will then apply custom params:

```
{
  "scope": "ManageLists,ImportSubscribers",
  "type": "web_server"
}
```    
## Example application (Server)
The following is a complete example app which will show youhow to coordinate the entire process:

```
/*
 * You'll want these dependencies to run the example code:
 *  
 *  "express": "^4.12.4",
 *  "express-session": "^1.11.2",
 *  "jade": "^1.10.0"
 */
var express = require('express');
var app = express();
var session = require('express-session');
var path = require('path');
var port = 3000;

/*
 * Passport requires we use sessions
 */
app.use(session(
  {
    secret: 'foo',
    resave: false,
    saveUninitialized: true,
    cookie: {}
  }
));

/*
 * Set views and pub folder
 */
app.set('views', __dirname);
app.set('view engine', 'jade');
app.use('/', express.static(path.join(__dirname, 'example-client')));

/*
 * Here's a view to see our integrations
 */
app.get('/', function(req, res){
  res.render('example', {integrations: integrations});
});

/*
 * Listen on the server
 */
var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});

/*
 * Add the integrations from an environment variable. 
 */
var integrations = JSON.parse(process.env.integrations);
var OAuthIntegrations = require('legolas');
integrations.oncomplete = {
  mailchimp: function(data, session, socket){
    console.log('mailchimp oncomplete fired', data);
  }
}

new OAuthIntegrations(app, 'http://127.0.0.1:'+port, integrations, server);
```

## Server side view
Note: You can grab the engine.io-client.js from [their repo](https://github.com/Automattic/engine.io-client/blob/master/engine.io.js).
```
html
  head
    title OAuth Examples
  body
    h1 Click an Integration to Run It
    - for (var key in integrations) {
      h2 OAuth 
        span= key
      - for (var k_ in integrations[key]){
      p
        a(href="/oauth/#{key}/#{k_}", target="_blank")= k_
      - }
    - }
    script(src="//code.jquery.com/jquery-2.1.4.min.js")
    script(src="/engine.io-client.js")
    script(src="/client.js")
```

## Client side JS
```
$(document).ready(function(){
  /*
   * Initialize Socket Server
   */
  var socket = new eio.Socket('ws://127.0.0.1:3000/');
  socket.on('open', function(){
    $.get('/socket/register/'+socket.id);

    socket.on('message', function(data){
      console.log('message received', data);
      var msg = JSON.parse(data);
      if(msg.oauth){
        for(var key in msg.oauth){
          if(msg.oauth[key].complete){
            var el = oauthInProgress[key];
            el.innerHTML = el.innerHTML.replace('in progress', 'complete'); 
          }
        }
      }
    });
  });

  /*
   * Keep track of what's in progress
   */
  var oauthInProgress = {};

  /*
   * Add Link Handlers
   */
  var links = $('a');
  links.each(function(i, link){
    link.onclick = function(){
      oauthInProgress[this.innerHTML] = this;
      this.innerHTML += ' - in progress';
      console.log('in progress is', oauthInProgress);
    }
  });
});
```

Run like this (notice I'm setting the contents of a file to an environment variable to keep keys out of code):

```
integrations=$(cat integrations.json) node example.js
```

[Image source](http://cliparts.co/cliparts/8cx/n5d/8cxn5dX9i.png)



