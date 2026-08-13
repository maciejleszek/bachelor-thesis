import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'health-monitor:api-url';

/// Domyślny adres API — nadpisywalny w buildzie przez
/// `flutter build ... --dart-define=API_URL=https://twoja-domena.pl/api`.
const defaultApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost/api',
);

String? _cachedBase;

Future<String> getApiUrl() async {
  if (_cachedBase != null) return _cachedBase!;
  final prefs = await SharedPreferences.getInstance();
  final stored = prefs.getString(_storageKey);
  _cachedBase = stored ?? defaultApiUrl;
  return _cachedBase!;
}

Future<void> setApiUrl(String url) async {
  final trimmed = url.trim().replaceFirst(RegExp(r'/+$'), '');
  _cachedBase = trimmed;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_storageKey, trimmed);
}

String getDefaultApiUrl() => defaultApiUrl;

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

Future<T> apiRequest<T>(
  String path, {
  String method = 'GET',
  Object? body,
  required T Function(dynamic json) parse,
}) async {
  final base = await getApiUrl();
  final uri = Uri.parse('$base$path');
  late http.Response res;
  final headers = {'Content-Type': 'application/json'};
  switch (method) {
    case 'POST':
      res = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
      break;
    case 'DELETE':
      res = await http.delete(uri, headers: headers);
      break;
    default:
      res = await http.get(uri, headers: headers);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw ApiException('HTTP ${res.statusCode} $path ${res.body}'.trim());
  }
  if (res.statusCode == 204 || res.body.isEmpty) {
    return parse(null);
  }
  return parse(jsonDecode(res.body));
}

String qs(Map<String, dynamic> params) {
  final clean = <String, String>{};
  params.forEach((k, v) {
    if (v != null && v != '') clean[k] = v.toString();
  });
  if (clean.isEmpty) return '';
  return '?${Uri(queryParameters: clean).query}';
}
