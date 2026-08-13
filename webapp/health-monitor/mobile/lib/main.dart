import 'package:flutter/material.dart';

import 'navigation/root_navigator.dart';
import 'theme/colors.dart';

void main() {
  runApp(const HealthMonitorApp());
}

class HealthMonitorApp extends StatelessWidget {
  const HealthMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Health Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.accent,
          brightness: Brightness.dark,
          surface: AppColors.surface,
        ),
        textTheme: Typography.whiteMountainView.apply(bodyColor: AppColors.text, displayColor: AppColors.text),
      ),
      home: const RootNavigator(),
    );
  }
}
