import 'client.dart';
import 'types.dart';

class Api {
  Api._();

  static Future<Summary> getSummary() =>
      apiRequest('/summary', parse: (j) => Summary.fromJson(j as Map<String, dynamic>));

  static Future<List<DailyMetric>> getMetrics({String? source, int? days}) => apiRequest(
        '/metrics${qs({'source': source, 'days': days})}',
        parse: (j) => (j as List)
            .map((e) => DailyMetric.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  static Future<List<Survey>> getSurveys({int limit = 30}) => apiRequest(
        '/surveys${qs({'limit': limit})}',
        parse: (j) =>
            (j as List).map((e) => Survey.fromJson(e as Map<String, dynamic>)).toList(),
      );

  static Future<void> postSurvey(Map<String, dynamic> body) => apiRequest(
        '/surveys',
        method: 'POST',
        body: body,
        parse: (_) {},
      );

  static Future<void> deleteSurvey(int id) => apiRequest(
        '/surveys/$id',
        method: 'DELETE',
        parse: (_) {},
      );

  static Future<List<Activity>> getActivities({String? sportType, int? days, int? limit}) =>
      apiRequest(
        '/activities${qs({'sport_type': sportType, 'days': days, 'limit': limit})}',
        parse: (j) =>
            (j as List).map((e) => Activity.fromJson(e as Map<String, dynamic>)).toList(),
      );

  static Future<CorrelationResult> getCorrelation({int? days}) => apiRequest(
        '/analysis/correlation${qs({'days': days})}',
        parse: (j) => CorrelationResult.fromJson(j as Map<String, dynamic>),
      );

  static Future<Map<String, dynamic>> health() => apiRequest(
        '/health',
        parse: (j) => j as Map<String, dynamic>,
      );
}
