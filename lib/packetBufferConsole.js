const PacketBuffer = require('./packetBuffer');

class PacketBufferConsole {
  constructor() {
    this.buffer = new Buffer(0);
    this.bufferImpl = new PacketBuffer();
  }

  write(data) {    
    // Append to buffer
    this.buffer = Buffer.concat([this.buffer, Buffer.from(data)]);
    
    while (this.buffer.length >= 4) {
      // Read packet block size
      const size = this.buffer.readUInt32LE(0);
      
      if (this.buffer.length < size)
        break;
    
      // Read packets in block
      this.bufferImpl.write(this.buffer.slice(4, size));
      
      // Remove block
      this.buffer = this.buffer.slice(size);
    }
  }

  read() {
    return this.bufferImpl.read();
  }
}

module.exports = PacketBufferConsole;
