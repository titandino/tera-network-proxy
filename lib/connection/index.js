const net = require('net');

const Dispatch = require('./dispatch');
const Encryption = require('./encryption');

class Connection {
    constructor(moduleFolder, metadata, clientInterfaceConnection) {
        this.moduleFolder = moduleFolder;
        this.metadata = metadata || {};
        this.clientInterfaceConnection = clientInterfaceConnection;
        this.client = null;
        this.dispatch = new Dispatch(this);

        this.state = -1;
        this.session = new Encryption(this.metadata.majorPatchVersion < 45);

        const bufferType = this.metadata.platform === 'console' ? require('../packetBufferConsole') : require('../packetBuffer');
        this.buffer = new bufferType();

        this.builder = this.metadata.platform === 'console' ? require('../packetBuilderConsole') : require('../packetBuilder');
    }

    connect(client, opt) {
        this.client = client;

        this.serverConnection = net.connect(opt);
        this.serverConnection.setNoDelay(true);

        this.serverConnection.on('connect', () => {
            this.state = -1;
            if (this.client)
                this.client.onConnect(this.serverConnection);
            else
                this.close();
        });

        this.serverConnection.on('data', (data) => {
            switch (this.state) {
                case -1: {
                    if (data.readUInt32LE(0) === 1) {
                        this.state = 0;
                        this.sendClient(data);
                    }
                    break;
                }

                case 0: {
                    if (data.length === 128) {
                        data.copy(this.session.serverKeys[0]);
                        this.state = 1;
                        this.sendClient(data);
                    }
                    break;
                }

                case 1: {
                    if (data.length === 128) {
                        data.copy(this.session.serverKeys[1]);
                        this.session.init();
                        this.state = 2;
                        this.sendClient(data);
                    }
                    break;
                }

                case 2: {
                    this.session.encrypt(data);
                    this.buffer.write(data);

                    // eslint-disable-next-line no-cond-assign
                    while (data = this.buffer.read()) {
                        if (this.dispatch)
                            data = this.dispatch.handle(data, true);

                        if (data)
                            this.sendClient(data);
                    }

                    break;
                }

                case 3:
                default: {
                    // closed
                    break;
                }
            }
        });

        this.serverConnection.on('close', () => {
            this.serverConnection = null;
            this.close();
        });

        return this.serverConnection;
    }

    setClientKey(key) {
        if (key.length !== 128) {
            throw new Error('key length != 128');
        }

        if (this.state !== 0 && this.state !== 1) {
            throw new Error('cannot set key in current state');
        }

        key.copy(this.session.clientKeys[this.state]);
        this.serverConnection.write(key);
    }

    sendClient(data) {
        if (this.client)
            this.client.onData(data);
    }

    sendServer(data) {
        if (this.serverConnection) {
            if (this.state === 2) {
                data = this.builder(data);
                this.session.decrypt(data);
            }

            this.serverConnection.write(data);
        }
    }

    close() {
        this.state = 3;

        if (this.serverConnection) {
            this.serverConnection.end();
            this.serverConnection.unref();
            this.serverConnection = null;
        }

        const { client } = this;
        if (client) {
            this.client = null; // prevent infinite recursion
            client.close();
        }

        if (this.dispatch) {
            this.dispatch.destructor();
            this.dispatch = null;
        }

        this.session = null;
        this.buffer = null;
    }
}

module.exports = Connection;
