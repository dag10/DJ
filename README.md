Computer Science House DJ
==

A web service to let multiple users take turns in playing music over a computer
connected stereo. Inspired by the late [turntable.fm](http://turntable.fm).

Installation
--
Enter the root directory, and run `npm install` to install the dependencies.

Then rename config.example.js to config.js and set up the configuration.

When running it for the first time, no migrations are necessary. Just launch
the server and the database will be populated for you.

Install the following packages with your system's package manager:
- exiftool
- lame
- flac
- ffmpeg

Webauth
--
If using [webauth](http://webauth.stanford.edu) as your authentication method,
require webauth for the only the `/webauth` location.

When configuring the reverse proxy, make sure to foward the
variables as headers for **all** locations:
- `WEBAUTH_USER` > `x-webauth-user`
- `WEBAUTH_LDAP_GIVENNAME` > `x-webauth-ldap-givenname`
- `WEBAUTH_LDAP_SN` > `x-webauth-ldap-sn`
- `WEBAUTH_LDAP_CN` > `x-webauth-ldap-cn`

Make sure to set `config.auth.webauth.logout_url` to a URL that will log the
user out of webauth.

Updating
--
When updating an existing installation, restart the server. When it starts,
it will automatically run the necessary migrations.

Running
--
To run, type `node app.js`.

--

[![CSH Logo](http://csh.rit.edu/images/logo.png)](http://csh.rit.edu)

