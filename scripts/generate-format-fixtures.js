// Script to generate test fixtures for Parquet and Avro formats
const parquet = require('parquetjs');
const avro = require('avsc');
const fs = require('fs');
const path = require('path');

async function generateTestFixtures() {
  const fixturesDir = path.join(__dirname, '..', 'test-fixtures');
  
  // Sample data
  const testData = [
    { id: 1, name: 'Alice', age: 30, score: 95.5, active: true },
    { id: 2, name: 'Bob', age: 25, score: 87.3, active: false },
    { id: 3, name: 'Charlie', age: 35, score: 92.1, active: true }
  ];
  
  // Generate Parquet file
  console.log('Generating sample.parquet...');
  const parquetSchema = new parquet.ParquetSchema({
    id: { type: 'INT64' },
    name: { type: 'UTF8' },
    age: { type: 'INT64' },
    score: { type: 'DOUBLE' },
    active: { type: 'BOOLEAN' }
  });
  
  const parquetPath = path.join(fixturesDir, 'sample.parquet');
  const writer = await parquet.ParquetWriter.openFile(parquetSchema, parquetPath);
  
  for (const row of testData) {
    await writer.appendRow(row);
  }
  
  await writer.close();
  console.log('✓ sample.parquet created');
  
  // Generate Avro file
  console.log('Generating sample.avro...');
  const avroSchema = avro.Type.forSchema({
    type: 'record',
    name: 'User',
    fields: [
      { name: 'id', type: 'int' },
      { name: 'name', type: 'string' },
      { name: 'age', type: 'int' },
      { name: 'score', type: 'double' },
      { name: 'active', type: 'boolean' }
    ]
  });
  
  const avroPath = path.join(fixturesDir, 'sample.avro');
  const avroEncoder = avro.createFileEncoder(avroPath, avroSchema);
  
  for (const row of testData) {
    avroEncoder.write(row);
  }
  
  avroEncoder.end();
  
  await new Promise((resolve) => {
    avroEncoder.on('finish', () => {
      console.log('✓ sample.avro created');
      resolve(undefined);
    });
  });
  
  console.log('\n✅ Test fixtures generated successfully!');
}

generateTestFixtures().catch(console.error);
