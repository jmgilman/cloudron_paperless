#!/usr/bin/env node

/* jslint node:true */
/* global it:false */
/* global xit:false */
/* global describe:false */
/* global before:false */
/* global after:false */

'use strict';

var execSync = require('child_process').execSync,
    ejs = require('ejs'),
    expect = require('expect.js'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    rimraf = require('rimraf'),
    superagent = require('superagent'),
    webdriver = require('selenium-webdriver');

var by = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until,
    Key = require('selenium-webdriver').Key,
    Builder = require('selenium-webdriver').Builder;

var sleep = require('sleep');
var nodemailer = require('nodemailer');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Application life cycle test', function () {
    this.timeout(0);
    var server, browser = new Builder().forBrowser('chrome').build();
    var LOCATION = 'test';
    var app;
    var username = process.env.USERNAME;
    var password = process.env.PASSWORD;

    before(function (done) {
        if (!process.env.USERNAME) return done(new Error('USERNAME env var not set'));
        if (!process.env.PASSWORD) return done(new Error('PASSWORD env var not set'));

        var seleniumJar= require('selenium-server-standalone-jar');
        var SeleniumServer = require('selenium-webdriver/remote').SeleniumServer;
        server = new SeleniumServer(seleniumJar.path, { port: 4444 });
        server.start();

        done();
    });

    after(function (done) {
        browser.quit();
        server.stop();
        done();
    });

    function getAppInfo() {
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];
        expect(app).to.be.an('object');
    }

    function login(done) {
        browser.get('https://' + app.fqdn + '/admin/login/?next=/');
        browser.findElement(by.xpath('//input[@name="username"]')).sendKeys(username);
        browser.findElement(by.xpath('//input[@name="password"]')).sendKeys(password);
        browser.findElement(by.id('login-form')).submit();
        browser.wait(until.elementLocated(by.css('.app-documents')), 4000).then(function () { done(); });
    }

    function seeUpload(done) {
        console.log('Sleeping for 40 seconds to allow consummation of document');
        sleep.sleep(40); // Need to wait for consumer to consume sample PDF

        browser.get('https://' + app.fqdn + '/admin/documents/document/');
        browser.findElement(by.xpath('//*[@id="changelist-form"]/div[2]/div/div/div[1]/div[2]/a')).getText().then(function(text) {
            expect(text).to.eql('pdf-sample');
            done();
        });
    }

    function deleteUpload(done) {
        browser.get('https://' + app.fqdn + '/admin/documents/document/');
        browser.findElement(by.xpath('//input[@name="_selected_action"]')).click();
        browser.findElement(by.xpath('//select[@name="action"]')).sendKeys('d');
        browser.findElement(by.id('changelist-form')).submit();
        browser.wait(until.elementLocated(by.css('.button.cancel-link')), 4000).then(function () {
            browser.findElement(by.xpath('//*[@id="content"]/form/div/input[4]')).click();
            browser.wait(until.elementLocated(by.css('.success')), 4000).then(function () { done(); });
        });
    }

    function validateAPI(done) {
        browser.manage().getCookies().then(function (cookies) {
            var cookiestring = '';
            for (var i = 0; i < cookies.length; i++) {
                cookiestring += cookies[i].name + '=' + cookies[i].value + ';';
            }
            superagent.get('https://' + app.fqdn + '/api/documents/?format=json')
                .set('Cookie', cookiestring)
                .end(function(err, res) {
                    expect(err).to.be(null);
                    expect(JSON.parse(res.text).results[0].content).to.contain('Fonts, and graphics are not lost due to platform');
                    done();
                });
        });

    }

    function postFile(done) {
        superagent.post('https://' + app.fqdn + '/push')
            .field('title', 'Test file')
            .field('correspondent', 'Cloudron')
            .attach('document', 'pdf-sample.pdf')
            .auth(username, password)
            .end(function (err, res) {
                expect(err).to.be(null);
                expect(res.status).to.eql(202);

                console.log('Sleeping for 40 seconds to allow consummation of document');
                sleep.sleep(40); // Need to wait for consumer to consume sample PDF
                done();
            });
    }

    function emailFile(done) {
        if (!process.env.SMTP_HOST) return done(new Error('SMTP_HOST env var not set - cannot test email functionality'));
        if (!process.env.SMTP_PORT) return done(new Error('SMTP_PORT env var not set - cannot test email functionality'));
        if (!process.env.SMTP_USER) return done(new Error('SMTP_USER env var not set - cannot test email functionality'));
        if (!process.env.SMTP_PASS) return done(new Error('SMTP_PASS env var not set - cannot test email functionality'));
        if (!process.env.SMTP_FROM) return done(new Error('SMTP_FROM env var not set - cannot test email functionality'));

        var transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // secure:true for port 465, secure:false for port 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        let mailOptions = {
            from: '"Cloudron Test" <' + process.env.SMTP_FROM + '>',
            to: app.location + '.app@' + app.fqdn, // list of receivers
            subject: 'cloudron - pdf-sample', // Subject line
            text: 'cloudron123',
            attachments: [
                {
                    filename: 'pdf-sample.pdf',
                    path: 'pdf-sample.pdf'
                }
            ]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            expect(error).to.be(null);
            done();
        });
    }


    xit('can build app', function () {
        execSync('cloudron build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can install app', function () {
        execSync('cloudron install --new --wait --location ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can get app information', getAppInfo);

    it('can get the main page', function (done) {
        superagent.get('https://' + app.fqdn).end(function (error, result) {
            expect(error).to.be(null);
            expect(result.status).to.eql(200);

            done();
        });
    });

    it('can login', login);

    it('can push sample PDF', function() {
        execSync('cloudron push pdf-sample.pdf /app/data/paperless/consume/pdf-sample.pdf', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    })

    it('can see uploaded file', seeUpload);

    it('can validate uploaded file through API', validateAPI)

    it('can delete uploaded file', deleteUpload)

    it('can email sample PDF', emailFile);

    it('restart app', function() {
        execSync('cloudron restart --app ' + app.id);
    });

    it('can see uploaded file', seeUpload);

    it('can delete uploaded file', deleteUpload)

    it('can POST sample PDF', postFile)

    it('restart app', function () {
        execSync('cloudron restart --app ' + app.id);
    });

    it('can validate uploaded file through API', validateAPI)

    it('backup app', function () {
        execSync('cloudron backup create --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('restore app', function () {
        execSync('cloudron restore --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can validate uploaded file through API', validateAPI)

    it('can delete uploaded file', deleteUpload)

    it('uninstall app', function () {
        execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
})