Computer Science House DJ
==

A web service to let multiple users take turns in playing music over a computer
connected stereo. Inspired by the late [turntable.fm](http://turntable.fm).

Installation
--
Enter the root directory, and run `npm install` to install the dependencies.

Then rename config.example.js to config.js and set up the configuration.

If using webauth, enable webauth for the / and /play/* directories, but no other
directories. When configuring the reverse proxy, make sure to foward the
variables as headers:
- WEBAUTH_USER -> x-webauth-user
- WEBAUTH_LDAP_GIVENNAME -> x-webauth-ldap-givenname
- WEBAUTH_LDAP_SN -> x-webauth-ldap-sn
- WEBAUTH_LDAP_CN -> x-webauth-ldap-cn

To run, type `node app.js`.

--

[![CSH Logo](http://csh.rit.edu/images/logo.png)](http://csh.rit.edu)

