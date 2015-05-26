module.exports = function(app, baseUrl, integrations, appServer, socketServer){
  /*
   * Pass in a socketServer or let one be created for you
   */
  if(!socketServer){
    var engine = require('engine.io');
    socketServer = engine.attach(appServer);
  }

  var passport = require('passport');
  var OAuth1Strategy = require('passport-oauth1');
  var OAuth2Strategy = require('passport-oauth2');

  app.use(passport.initialize());
  app.use(passport.session());

  /*
   * Were any "oncomplete" handlers registered?
   */
  var onComplete = integrations.oncomplete;
  delete integrations.oncomplete;

  /*
   * Add a ref to the socket to the session so we can send updates to the client
   */
  app.get('/socket/register/:socketid', function(req, res){
    req.session.socket = req.params.socketid;
    console.log('socket registered with session', req.session.socket);
    res.status(200).send();
  });

  /*
   * Generic functions to add oauth to app
   */
  function addOAuth(protocol, provider){
    var route = ['/oauth', protocol, provider].join('/');

    app.get(route, passport.authenticate(provider));

    app.get(route+'/error', function(req, res){
      res.status(500).send('An error has occurred'); 
    });

    /*
     * This gets called on complete
     */
    app.get(route+'/callback', 
      passport.authenticate(provider, { failureRedirect: route+'/error' }),
      function(req, res) {
        //Save this so we can reference it when ready
        req.session.oauths = req.session.oauths || {};
        req.session.oauths[provider] = req.user[provider];
        console.log('oauth data in server for', Object.keys(req.session.oauths));

        //Notify the client that oauth is complete
        console.log('sending finish message');
        var client = socketServer.clients[req.session.socket];
        var obj = {oauth: {}};
        obj.oauth[provider] = {complete: true};

        client.send(JSON.stringify(obj));

        //Callback
        if(onComplete && onComplete[provider]){
          onComplete[provider](req.session.oauths[provider], req.session, socketServer.clients[req.session.socket]);
        }

        res.send('<script>close();</script>');
      }
    );
  }

  /*
   * Build the integrations
   */
  var strategy = function(protocol, provider, opts){
    var s = null;
    var sOpts = {};
    var extraOpts = null;

    if(protocol == '1.0'){
      s = OAuth1Strategy;
      extraOpts = opts[5];
      sOpts = {
        requestTokenURL: opts[0],
        accessTokenURL: opts[1],
        userAuthorizationURL: opts[2],
        consumerKey: opts[3],
        consumerSecret: opts[4],
        callbackURL: baseUrl+"/oauth/1.0/"+provider+"/callback"
      }
    } else if(protocol == '2.0') {
      s = OAuth2Strategy;
      extraOpts = opts[4];
      sOpts = {
        authorizationURL: opts[0],
        tokenURL: opts[1],
        clientID: opts[2],
        clientSecret: opts[3],
        callbackURL: baseUrl+"/oauth/2.0/"+provider+"/callback"
      }
    }

    //Were additional opts passed via object?
    if(extraOpts){
      for(var k in extraOpts){
        sOpts[k] = extraOpts[k];
      }
    }

    //Add routes for this integration
    addOAuth(protocol, provider);

    //Add callback for this integration
    passport.use(provider, new s(sOpts, function(t1, t2, profile, done){
      var obj = {};
      if(protocol == '1.0'){
        obj.token = t1;
        obj.tokenSecret = t2;
      } else if(protocol == '2.0'){
        obj.accessToken = t1;
        obj.refreshToken = t2;
      }
      obj.profile = profile;
      
      var store = {}
      store[provider] = obj;
      return done(null, store);
    }));
  }

  for(var protocol in integrations){
    for(var provider in integrations[protocol]){
      var opts = integrations[protocol][provider];
      strategy(protocol, provider, opts);
    }
  }

  /*
   * These are used to serialize / deserialize user
   */
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });
}
