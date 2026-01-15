# Kafka Module

This module provides Kafka consumer and producer functionality for the agent-service.

## Configuration

Add the following environment variables to your `.env.agentservice` file or AWS Secrets Manager:

```env
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=agent-service
KAFKA_CONSUMER_GROUP_ID=agent-service-group
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password
KAFKA_SSL=false
```

### Configuration Options

- `KAFKA_BROKERS`: Comma-separated list of Kafka broker addresses (default: `localhost:9092`)
- `KAFKA_CLIENT_ID`: Client identifier for this service (default: `agent-service`)
- `KAFKA_CONSUMER_GROUP_ID`: Consumer group ID (default: `agent-service-group`)
- `KAFKA_SASL_MECHANISM`: SASL mechanism (`plain`, `scram-sha-256`, `scram-sha-512`) (optional)
- `KAFKA_SASL_USERNAME`: SASL username (optional)
- `KAFKA_SASL_PASSWORD`: SASL password (optional)
- `KAFKA_SSL`: Enable SSL/TLS (default: `false`)

## Consumers

### Enterprise Agent Updated Consumer

Consumes messages from the `Enterprise_AgentUpdated_V2` topic.

- **Topic**: `Enterprise_AgentUpdated_V2`
- **Consumer Group**: `agent-service-group`
- **Handler**: `EnterpriseAgentUpdatedConsumer`

The consumer automatically starts when the application starts and stops gracefully on shutdown.

#### Message Processing

Messages are parsed as JSON and processed by the `processAgentUpdate` method. Currently, this is a placeholder implementation that logs the received data. You should implement your actual business logic in this method.

## Architecture

- **KafkaClientService**: Singleton service that provides a shared Kafka client instance
- **KafkaProducerService**: Service for producing messages to Kafka topics
- **EnterpriseAgentUpdatedConsumer**: Consumer that processes messages from the Enterprise_AgentUpdated_V2 topic
- **KafkaModule**: NestJS module that wires everything together and manages lifecycle

## Usage

The Kafka module is automatically initialized when the application starts. The consumer will:

1. Connect to Kafka brokers
2. Subscribe to the `Enterprise_AgentUpdated_V2` topic
3. Process messages as they arrive
4. Log all operations for monitoring and debugging

## Producer

The `KafkaProducerService` provides methods to send messages to Kafka topics.

### Sending to Global_SMS_SponsorChanged_V2

```typescript
import { KafkaProducerService } from './modules/kafka/kafka-producer.service.js';

// Inject the service
constructor(private readonly kafkaProducer: KafkaProducerService) {}

// Send a message to Global_SMS_SponsorChanged_V2 topic
await this.kafkaProducer.sendSponsorChangedMessage(
  {
    sponsorId: '123',
    agentId: '456',
    // ... other fields
  },
  'message-key', // Optional: message key for partitioning
  { 'correlation-id': 'abc-123' } // Optional: headers
);
```

### Sending to Any Topic

```typescript
// Send a message to any topic
await this.kafkaProducer.sendMessage(
  'my-topic',
  { key: 'value' }, // Will be JSON stringified
  'message-key', // Optional
  { 'custom-header': 'value' } // Optional headers
);
```

## Proof of Concept

This is currently a proof of concept implementation that:
- Consumes one message at a time
- Logs the message content
- Provides a placeholder for business logic implementation

To implement your business logic, modify the `processAgentUpdate` method in `EnterpriseAgentUpdatedConsumer`.

