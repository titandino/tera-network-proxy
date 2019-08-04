function PacketBuilder(data) {
  let len_buffer = new Buffer(4);
  len_buffer.writeUInt32LE(data.length + 4, 0);
  
  return Buffer.concat([len_buffer, data]);
}

module.exports = PacketBuilder;
