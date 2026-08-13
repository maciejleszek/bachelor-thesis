num? _num(dynamic v) => v == null ? null : (v as num);
String? _str(dynamic v) => v as String?;

class DailyMetric {
  final String date;
  final String source;
  final num? avgHr;
  final num? maxHr;
  final num? restingHr;
  final num? hrv;
  final num? spo2;
  final num? steps;
  final num? avgStress;
  final num? maxStress;
  final num? sleepTotalMin;
  final num? sleepDeepMin;
  final num? sleepLightMin;
  final num? sleepRemMin;
  final num? sleepScore;

  DailyMetric({
    required this.date,
    required this.source,
    this.avgHr,
    this.maxHr,
    this.restingHr,
    this.hrv,
    this.spo2,
    this.steps,
    this.avgStress,
    this.maxStress,
    this.sleepTotalMin,
    this.sleepDeepMin,
    this.sleepLightMin,
    this.sleepRemMin,
    this.sleepScore,
  });

  factory DailyMetric.fromJson(Map<String, dynamic> j) => DailyMetric(
        date: j['date'] as String,
        source: j['source'] as String? ?? '',
        avgHr: _num(j['avg_hr']),
        maxHr: _num(j['max_hr']),
        restingHr: _num(j['resting_hr']),
        hrv: _num(j['hrv']),
        spo2: _num(j['spo2']),
        steps: _num(j['steps']),
        avgStress: _num(j['avg_stress']),
        maxStress: _num(j['max_stress']),
        sleepTotalMin: _num(j['sleep_total_min']),
        sleepDeepMin: _num(j['sleep_deep_min']),
        sleepLightMin: _num(j['sleep_light_min']),
        sleepRemMin: _num(j['sleep_rem_min']),
        sleepScore: _num(j['sleep_score']),
      );

  bool get hasAnyData =>
      avgHr != null || hrv != null || steps != null || sleepTotalMin != null || spo2 != null;
}

class Survey {
  final int id;
  final String date;
  final num? samValence;
  final num? samArousal;
  final num? samDominance;
  final num? vasStress;
  final String? notes;
  final String? createdAt;

  Survey({
    required this.id,
    required this.date,
    this.samValence,
    this.samArousal,
    this.samDominance,
    this.vasStress,
    this.notes,
    this.createdAt,
  });

  factory Survey.fromJson(Map<String, dynamic> j) => Survey(
        id: j['id'] as int,
        date: j['date'] as String,
        samValence: _num(j['sam_valence']),
        samArousal: _num(j['sam_arousal']),
        samDominance: _num(j['sam_dominance']),
        vasStress: _num(j['vas_stress']),
        notes: _str(j['notes']),
        createdAt: _str(j['created_at']),
      );
}

class BloodPressure {
  final int id;
  final num sys;
  final num dia;
  final num? pulse;
  final String? notes;
  final String? measuredAt;

  BloodPressure({
    required this.id,
    required this.sys,
    required this.dia,
    this.pulse,
    this.notes,
    this.measuredAt,
  });

  factory BloodPressure.fromJson(Map<String, dynamic> j) => BloodPressure(
        id: j['id'] as int,
        sys: j['sys'] as num,
        dia: j['dia'] as num,
        pulse: _num(j['pulse']),
        notes: _str(j['notes']),
        measuredAt: _str(j['measured_at']),
      );
}

class Activity {
  final int id;
  final String? source;
  final String? name;
  final String sportType;
  final String startTime;
  final num? durationSec;
  final num? distanceM;
  final num? calories;
  final num? avgHr;
  final num? maxHr;
  final num? avgSpeedMps;
  final num? trainingLoad;

  Activity({
    required this.id,
    this.source,
    this.name,
    required this.sportType,
    required this.startTime,
    this.durationSec,
    this.distanceM,
    this.calories,
    this.avgHr,
    this.maxHr,
    this.avgSpeedMps,
    this.trainingLoad,
  });

  factory Activity.fromJson(Map<String, dynamic> j) => Activity(
        id: j['id'] as int,
        source: _str(j['source']),
        name: _str(j['name']),
        sportType: j['sport_type'] as String,
        startTime: j['start_time'] as String,
        durationSec: _num(j['duration_sec']),
        distanceM: _num(j['distance_m']),
        calories: _num(j['calories']),
        avgHr: _num(j['avg_hr']),
        maxHr: _num(j['max_hr']),
        avgSpeedMps: _num(j['avg_speed_mps']),
        trainingLoad: _num(j['training_load']),
      );
}

class Summary {
  final List<DailyMetric> metrics;
  final List<Survey> surveys;
  final List<BloodPressure> bloodPressure;

  Summary({required this.metrics, required this.surveys, required this.bloodPressure});

  factory Summary.fromJson(Map<String, dynamic> j) => Summary(
        metrics: ((j['metrics'] as List?) ?? [])
            .map((e) => DailyMetric.fromJson(e as Map<String, dynamic>))
            .toList(),
        surveys: ((j['surveys'] as List?) ?? [])
            .map((e) => Survey.fromJson(e as Map<String, dynamic>))
            .toList(),
        bloodPressure: ((j['blood_pressure'] as List?) ?? [])
            .map((e) => BloodPressure.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CorrelationEntry {
  final double? r;
  final int n;

  CorrelationEntry({this.r, required this.n});

  factory CorrelationEntry.fromJson(Map<String, dynamic> j) => CorrelationEntry(
        r: (j['r'] as num?)?.toDouble(),
        n: j['n'] as int? ?? 0,
      );
}

class CorrelationResult {
  final Map<String, CorrelationEntry> correlations;

  CorrelationResult({required this.correlations});

  factory CorrelationResult.fromJson(Map<String, dynamic> j) {
    final raw = (j['correlations'] as Map<String, dynamic>?) ?? {};
    return CorrelationResult(
      correlations: raw.map(
        (k, v) => MapEntry(k, CorrelationEntry.fromJson(v as Map<String, dynamic>)),
      ),
    );
  }
}
