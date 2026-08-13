import 'package:flutter/material.dart';

import '../api/endpoints.dart';
import '../api/types.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';

class SportScreen extends StatefulWidget {
  const SportScreen({super.key});

  @override
  State<SportScreen> createState() => _SportScreenState();
}

class _SportScreenState extends State<SportScreen> {
  bool _loading = true;
  bool _refreshing = false;
  Object? _error;
  List<Activity> _activities = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool refresh = false}) async {
    setState(() {
      refresh ? _refreshing = true : _loading = true;
      _error = null;
    });
    try {
      final data = await Api.getActivities(days: 90, limit: 50);
      setState(() => _activities = data);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  static String _fmtDuration(num? sec) {
    if (sec == null || sec == 0) return '—';
    final h = sec ~/ 3600;
    final m = ((sec % 3600) / 60).round();
    return h > 0 ? '${h}h ${m}min' : '${m}min';
  }

  static String _fmtDistance(num? m) => (m == null || m == 0) ? '—' : '${(m.toDouble() / 1000).toStringAsFixed(2)} km';

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Screen(
        title: 'Sport',
        children: [Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: AppColors.accent)))],
      );
    }
    if (_error != null) {
      return Screen(
        title: 'Sport',
        onRefresh: () => _load(refresh: true),
        children: [EmptyState(text: 'Błąd połączenia: $_error')],
      );
    }

    return Screen(
      title: 'Sport',
      onRefresh: () => _load(refresh: true),
      refreshing: _refreshing,
      children: [
        if (_activities.isEmpty) const EmptyState(text: 'Brak aktywności z ostatnich 90 dni.'),
        for (final a in _activities)
          AppCard(children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    a.name?.isNotEmpty == true ? a.name! : a.sportType,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                Text(
                  _fmtDate(a.startTime),
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
            Text(a.sportType.toUpperCase(), style: const TextStyle(color: AppColors.accent, fontSize: 11)),
            const SizedBox(height: 8),
            Row(
              children: [
                _stat('Czas', _fmtDuration(a.durationSec)),
                _stat('Dystans', _fmtDistance(a.distanceM)),
                _stat('Kalorie', a.calories != null ? '${a.calories!.round()} kcal' : '—'),
                _stat('Śr. HR', a.avgHr != null ? '${a.avgHr!.round()} bpm' : '—'),
              ],
            ),
          ]),
      ],
    );
  }

  static String _fmtDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
  }

  Widget _stat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        ],
      ),
    );
  }
}
