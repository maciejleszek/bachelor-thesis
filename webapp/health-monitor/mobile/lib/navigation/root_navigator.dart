import 'package:flutter/material.dart';

import '../screens/analysis_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/sleep_screen.dart';
import '../screens/sport_screen.dart';
import '../screens/survey_screen.dart';
import '../theme/colors.dart';

class RootNavigator extends StatefulWidget {
  const RootNavigator({super.key});

  @override
  State<RootNavigator> createState() => _RootNavigatorState();
}

class _RootNavigatorState extends State<RootNavigator> {
  int _index = 0;

  static const _screens = [
    DashboardScreen(),
    SleepScreen(),
    SportScreen(),
    AnalysisScreen(),
    SurveyScreen(),
    SettingsScreen(),
  ];

  static const _items = [
    BottomNavigationBarItem(icon: Icon(Icons.speed_outlined), label: 'Dashboard'),
    BottomNavigationBarItem(icon: Icon(Icons.nightlight_outlined), label: 'Sen'),
    BottomNavigationBarItem(icon: Icon(Icons.directions_walk_outlined), label: 'Sport'),
    BottomNavigationBarItem(icon: Icon(Icons.analytics_outlined), label: 'Analiza'),
    BottomNavigationBarItem(icon: Icon(Icons.sentiment_satisfied_outlined), label: 'Ankieta'),
    BottomNavigationBarItem(icon: Icon(Icons.settings_outlined), label: 'Ustawienia'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.accent,
        unselectedItemColor: AppColors.muted,
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: _items,
      ),
    );
  }
}
