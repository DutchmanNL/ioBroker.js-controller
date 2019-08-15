/* jshint -W097 */
/* jshint strict:false */
/* jslint node:true */
/* jshint expr:true */
'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;

before(() => {
    chai.should();
    chai.use(chaiAsPromised);
});

const setup  = require('./setup4controller');

function testAdapter(options) {
    const statesConfig  = options.statesConfig;
    const objectsConfig = options.objectsConfig;
    options.name  = options.name || 'Test';

    const tests = [
        require('./testAdapterHelpers'),
//        require('./testEnums'),
 //       require('./testFiles'),
 //       require('./testHelperStates'),
 //       require('./testMessages'),
  //      require('./testObjectsFunctions'),
  //      require('./testObjectsACL'),
  //      require('./testStates'),
        require('./testAliases'),
  //      require('./testConsole')
    ];

    const context = {
        objects: null,
        states: null,
        adapter: null,
        onControllerStateChanged: null,
        onControllerObjectChanged: null,
        onAdapterStateChanged: null,
        onAdapterObjectChanged: null,
        onAdapterUnload: null,
        onAdapterMessage: null,
        sendToID: 1,
        adapterShortName: 'test',
        name: options.name,
        appName: setup.appName
    };

    function startAdapter(callback) {
        const Adapter = require('../../lib/adapter.js');

        context.adapter = new Adapter({
            config: {
                states: statesConfig,
                objects: objectsConfig,
                consoleOutput: true
            },
            dirname: __dirname + '/',
            name: context.adapterShortName,
            objectChange: (id, obj) => {
                if (context.onAdapterObjectChanged) {
                    context.onAdapterObjectChanged(id, obj);
                }
            },
            stateChange: (id, state) => {
                if (context.onAdapterStateChanged) {
                    context.onAdapterStateChanged(id, state);
                }
            },
            unload: callback => {
                if (context.onAdapterUnload) context.onAdapterUnload(callback);
            },
            message: obj => {
                if (context.onAdapterMessage) context.onAdapterMessage(obj);

            },
            ready: () => {
                if (callback) callback();
            },
            compact: true
        });
    }

    function checkConnectionOfAdapter(isConnected, cb, counter) {
        counter = counter || 0;
        console.log('Try check #' + counter);
        if (counter > 30) {
            if (cb) cb('Cannot check connection');
            return;
        }

        context.states.getState('system.adapter.' + context.adapterShortName + '.0.alive', (err, state) => {
            if (err) console.error(err);
            if (state && (state.val === isConnected)) {
                if (cb) cb();
            } else {
                setTimeout(() => checkConnectionOfAdapter(isConnected, cb, counter + 1), 1000);
            }
        });
    }

    // TODO: This is unused:
    function checkValueOfState(id, value, cb, counter) {
        counter = counter || 0;
        if (counter > 20) {
            if (cb) cb('Cannot check value Of State ' + id);
            return;
        }

        context.states.getState(id, (err, state) => {
            if (err) console.error(err);
            if (value === null && !state) {
                if (cb) cb();
            } else
            if (state && (value === undefined || state.val === value)) {
                if (cb) cb();
            } else {
                setTimeout(function () {
                    checkValueOfState(id, value, cb, counter + 1);
                }, 500);
            }
        });
    }

    // TODO: This is unused:
    function sendTo(target, command, message, callback) {
        context.onControllerStateChanged = function (id, state) {
            if (id === 'messagebox.system.adapter.test.0') {
                callback(state.message);
            }
        };

        context.states.pushMessage('system.adapter.' + target, {
            command:    command,
            message:    message,
            from:       'system.adapter.test.0',
            callback: {
                message: message,
                id:      sendToID++, // TODO: sendToID is undefined!
                ack:     false,
                time:    (new Date()).getTime()
            }
        });
    }

    function addObjects(objects, objs, callback) {
        for (const id in objs) {
            if (objs.hasOwnProperty(id) && objs[id]) {
                const obj = objs[id];
                objs[id] = null;
                return objects.setObject(id, obj, err => {
                    err && console.error(err);
                    setImmediate(addObjects, objects, objs, callback);
                });
            }
        }
        callback && callback();
    }

    function addInstance() {
        const fs = require('fs');
        if (!fs.existsSync(setup.rootDir + 'tmp/')) {
            fs.mkdirSync(setup.rootDir + 'tmp/');
        }
        if (statesConfig.dataDir && !fs.existsSync(statesConfig.dataDir)) {
            fs.mkdirSync(statesConfig.dataDir);
        }
        if (objectsConfig.dataDir && !fs.existsSync(objectsConfig.dataDir)) {
            fs.mkdirSync(objectsConfig.dataDir);
        }
        if (objectsConfig.dataDir) fs.writeFileSync(objectsConfig.dataDir + '/objects.json', fs.readFileSync(__dirname + '/objects.json'));
        if (statesConfig.dataDir) fs.writeFileSync(statesConfig.dataDir + '/states.json', fs.readFileSync(__dirname + '/states.json'));
    }

    describe(options.name + ' ' + context.adapterShortName + ' adapter', function () {
        before('Test ' + context.adapterShortName + ' adapter: Start js-controller and adapter', function (_done) {
            this.timeout(10000); // no installation

            addInstance();
            const _statesConfig  = JSON.parse(JSON.stringify(statesConfig));
            const _objectsConfig = JSON.parse(JSON.stringify(objectsConfig));

            _statesConfig.onChange = (id, state) => {
                console.log('state changed. ' + id);
                if (context.onControllerStateChanged) context.onControllerStateChanged(id, state);
            };
            _objectsConfig.onChange = (id, obj) => {
                console.log('object changed. ' + id);
                if (context.onControllerObjectChanged) context.onControllerObjectChanged(id, obj);
            };

            setup.startController({
                objects: _objectsConfig,
                states: _statesConfig
            },
            (_objects, _states) => {
                context.objects = _objects;
                context.states  = _states;
                expect(context.objects).to.be.ok;
                expect(context.states).to.be.ok;

                if (objectsConfig.type === 'redis') {
                    const objs = require('./objects.json');
                    addObjects(_objects, objs, () =>
                        startAdapter(() => _done()));
                } else {
                    startAdapter(() => _done());
                }
            }
            );
        });

        it(options.name + ' ' + context.adapterShortName + ' adapter: Check if adapter started', function (done) {
            this.timeout(60000);
            checkConnectionOfAdapter(true, function (err) {
                if (err) console.log(err);
                expect(err).not.to.be.equal('Cannot check connection');
                done();
            });
        });

        it(options.name + ' ' + context.adapterShortName + ' adapter: check all important adapter attributes', function (done) {
            this.timeout(1000);
            expect(context.adapter.namespace).to.be.equal(context.adapterShortName + '.0');
            expect(context.adapter.name).to.be.equal(context.adapterShortName);
            expect(context.adapter.instance).to.be.equal(0);
            expect(context.adapter.states).to.be.ok;
            expect(context.adapter.objects).to.be.ok;
            expect(context.adapter.log).to.be.ok;
            expect(context.adapter.log.info).to.be.a('function');
            expect(context.adapter.log.debug).to.be.a('function');
            expect(context.adapter.log.warn).to.be.a('function');
            expect(context.adapter.log.error).to.be.a('function');
            expect(context.adapter.config.paramString).to.be.equal('value1');
            expect(context.adapter.config.paramNumber).to.be.equal(42);
            expect(context.adapter.config.paramBoolean).to.be.equal(false);
            expect(context.adapter.config.username).to.be.equal('tesla');
            expect(context.adapter.config.password).to.be.equal('winning');
            let count = 0;

            context.states.getState('system.adapter.' + context.adapterShortName + '.0.connected', function (err, state) {
                expect(state.val).to.be.equal(true);
                setTimeout(() => (!--count) && done(), 0);
            });

            count++;
            context.states.getState('system.adapter.' + context.adapterShortName + '.0.memRss', function (err, state) {
                expect(state.val).to.be.above(0);
                setTimeout(() => (!--count) && done(), 0);
            });

            count++;
            context.states.getState('system.adapter.' + context.adapterShortName + '.0.memHeapTotal', function (err, state) {
                expect(state.val).to.be.above(0);
                setTimeout(function () {
                    if (!--count) done();
                }, 0);setTimeout(() => (!--count) && done(), 0);
            });

            count++;
            context.states.getState('system.adapter.' + context.adapterShortName + '.0.memHeapUsed', function (err, state) {
                expect(state.val).to.be.above(0);
                setTimeout(() => (!--count) && done(), 0);
            });

            count++;
            context.states.getState('system.adapter.' + context.adapterShortName + '.0.uptime', function (err, state) {
                expect(state.val).to.be.at.least(0);
                setTimeout(() => (!--count) && done(), 0);
            });
        });

        for (let t = 0; t < tests.length; t++) {
            tests[t].register(it, expect, context);
        }

        // sendTo => controller => adapter
        // sendToHost - cannot be tested

        // this test is 15 seconds long. Enable it only if ready to push
        /*it(options.name + ' ' + context.adapterShortName + ' adapter: Check if uptime changes', function (done) {
         this.timeout(20000);

         context.states.getState('system.adapter.' + context.adapterShortName + '.0.uptime', function (err, state1) {
         expect(err).to.be.not.ok;
         expect(state1).to.be.ok;
         expect(state1.val).to.be.ok;

         setTimeout(function () {
         context.states.getState('system.adapter.' + context.adapterShortName + '.0.uptime', function (err, state2) {
         expect(err).to.be.not.ok;
         expect(state2).to.be.ok;
         expect(state2.val).to.be.ok;
         if (state2.val !== state1.val) {
         expect(state2.val).to.be.above(state1.val);
         done();
         } else {
         setTimeout(function () {
         context.states.getState('system.adapter.' + context.adapterShortName + '.0.uptime', function (err, state2) {
         expect(err).to.be.not.ok;
         expect(state2).to.be.ok;
         expect(state2.val).to.be.ok;
         if (state2.val !== state1.val) {
         expect(state2.val).to.be.above(state1.val);
         done();
         } else {
         setTimeout(function () {
         context.states.getState('system.adapter.' + context.adapterShortName + '.0.uptime', function (err, state2) {
         expect(err).to.be.not.ok;
         expect(state2).to.be.ok;
         expect(state2.val).to.be.ok;
         expect(state2.val).to.be.above(state1.val);
         done();
         });
         }, 6000);
         }
         });
         }, 5000);
         }
         });
         }, 5000);
         });
         });*/

        after(options.name + ' ' + context.adapterShortName + ' adapter: Stop js-controller', function (done) {
            this.timeout(10000);

            expect(context.adapter.connected).to.be.true;
            setup.stopController(normalTerminated => {
                console.log('Adapter normal terminated: ' + normalTerminated);
                // redis server cannot be stopped
                if (objectsConfig.type === 'file') {
                    setTimeout(() => {
                        expect(context.adapter.connected).to.be.false;
                        context.adapter.stop();
                        context.adapter.on('exit', () => {
                            setTimeout(done, 2000);
                        });
                    }, 500);
                } else {
                    setTimeout(done, 2000);
                }
            });
        });
    });
}
module.exports = testAdapter;
