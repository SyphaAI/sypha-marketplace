---
name: beam-concepts
description: >-
  Covers foundational Apache Beam programming model concepts such as
  PCollections, PTransforms, Pipelines, and Runners. Use when studying Beam
  fundamentals or describing pipeline concepts.
metadata:
  category: data
  source:
    repository: 'https://github.com/apache/beam'
    path: .agent/skills/beam-concepts
    license_path: LICENSE
    commit: 0802263e48e842bfbe437ed9b8ec72c2311c0d76
---

# Apache Beam Core Concepts

## The Beam Model
Originated from Google's MapReduce, FlumeJava, and Millwheel projects. Initially known as the "Dataflow Model."

## Key Abstractions

### Pipeline
A Pipeline wraps the complete data processing task, encompassing reading, transforming, and writing data.

```java
// Java
Pipeline p = Pipeline.create(options);
p.apply(...)
 .apply(...)
 .apply(...);
p.run().waitUntilFinish();
```

```python
# Python
with beam.Pipeline(options=options) as p:
    (p | 'Read' >> beam.io.ReadFromText('input.txt')
       | 'Transform' >> beam.Map(process)
       | 'Write' >> beam.io.WriteToText('output'))
```

### PCollection
A distributed dataset that may be either bounded (batch) or unbounded (streaming).

#### Properties
- **Immutable** - After creation, the collection cannot be changed
- **Distributed** - Elements are processed in parallel
- **May be bounded or unbounded**
- **Timestamped** - Every element carries an event timestamp
- **Windowed** - Elements are placed into windows

### PTransform
A data processing operation that produces new PCollections from existing ones.

```java
// Java
PCollection<String> output = input.apply(MyTransform.create());
```

```python
# Python
output = input | 'Name' >> beam.ParDo(MyDoFn())
```

## Core Transforms

### ParDo
A general-purpose element-wise parallel processing transform.

```java
// Java
input.apply(ParDo.of(new DoFn<String, Integer>() {
    @ProcessElement
    public void processElement(@Element String element, OutputReceiver<Integer> out) {
        out.output(element.length());
    }
}));
```

```python
# Python
class LengthFn(beam.DoFn):
    def process(self, element):
        yield len(element)

input | beam.ParDo(LengthFn())
# Or simpler:
input | beam.Map(len)
```

### GroupByKey
Collects elements together by their key.

```java
PCollection<KV<String, Integer>> input = ...;
PCollection<KV<String, Iterable<Integer>>> grouped = input.apply(GroupByKey.create());
```

### CoGroupByKey
Performs a relational join across multiple PCollections sharing the same key.

### Combine
Aggregates elements using operations such as sum, mean, and similar reductions.

```java
// Global combine
input.apply(Combine.globally(Sum.ofIntegers()));

// Per-key combine
input.apply(Combine.perKey(Sum.ofIntegers()));
```

### Flatten
Combines several PCollections into a single one.

```java
PCollectionList<String> collections = PCollectionList.of(pc1).and(pc2).and(pc3);
PCollection<String> merged = collections.apply(Flatten.pCollections());
```

### Partition
Divides a single PCollection into multiple separate PCollections.

## Windowing

### Types
- **Fixed Windows** - Uniform, non-overlapping time intervals
- **Sliding Windows** - Intervals that overlap one another
- **Session Windows** - Boundaries determined by periods of inactivity
- **Global Window** - Every element belongs to a single window (default)

```java
input.apply(Window.into(FixedWindows.of(Duration.standardMinutes(5))));
```

```python
input | beam.WindowInto(beam.window.FixedWindows(300))
```

## Triggers
Determine the conditions under which results are emitted from a window.

```java
input.apply(Window.<T>into(FixedWindows.of(Duration.standardMinutes(5)))
    .triggering(AfterWatermark.pastEndOfWindow()
        .withEarlyFirings(AfterProcessingTime.pastFirstElementInPane()
            .plusDelayOf(Duration.standardMinutes(1))))
    .withAllowedLateness(Duration.standardHours(1))
    .accumulatingFiredPanes());
```

## Side Inputs
Supplementary data made available to a ParDo transform at runtime.

```java
PCollectionView<Map<String, String>> sideInput =
    lookupTable.apply(View.asMap());

mainInput.apply(ParDo.of(new DoFn<String, String>() {
    @ProcessElement
    public void processElement(ProcessContext c) {
        Map<String, String> lookup = c.sideInput(sideInput);
        // Use lookup...
    }
}).withSideInputs(sideInput));
```

## Pipeline Options
Settings that control how a pipeline is executed.

```java
public interface MyOptions extends PipelineOptions {
    @Description("Input file")
    @Required
    String getInput();
    void setInput(String value);
}

MyOptions options = PipelineOptionsFactory.fromArgs(args).as(MyOptions.class);
```

## Schema
Provides strongly-typed access to structured data within PCollections.

```java
@DefaultSchema(AutoValueSchema.class)
@AutoValue
public abstract class User {
    public abstract String getName();
    public abstract int getAge();
}

PCollection<User> users = ...;
PCollection<Row> rows = users.apply(Convert.toRows());
```

## Error Handling

### Dead-Letter Queue Pattern
```java
TupleTag<String> successTag = new TupleTag<>() {};
TupleTag<String> failureTag = new TupleTag<>() {};

PCollectionTuple results = input.apply(ParDo.of(new DoFn<String, String>() {
    @ProcessElement
    public void processElement(ProcessContext c) {
        try {
            c.output(process(c.element()));
        } catch (Exception e) {
            c.output(failureTag, c.element());
        }
    }
}).withOutputTags(successTag, TupleTagList.of(failureTag)));

results.get(successTag).apply(WriteToSuccess());
results.get(failureTag).apply(WriteToDeadLetter());
```

## Cross-Language Pipelines
Enables the use of transforms defined in other language SDKs within a pipeline.

```python
# Use Java Kafka connector from Python
from apache_beam.io.kafka import ReadFromKafka

result = pipeline | ReadFromKafka(
    consumer_config={'bootstrap.servers': 'localhost:9092'},
    topics=['my-topic']
)
```

## Best Practices
1. **Prefer built-in transforms** rather than writing custom DoFns
2. **Use schemas** to enable type-safe pipeline operations
3. **Minimize side inputs** to avoid performance bottlenecks
4. **Handle late data** with an explicit strategy
5. **Test with DirectRunner** prior to deploying to a production runner
6. **Use TestPipeline** when writing unit tests
