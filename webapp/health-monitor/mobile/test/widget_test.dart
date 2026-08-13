import 'package:flutter_test/flutter_test.dart';

import 'package:health_monitor/main.dart';

void main() {
  testWidgets('app renders bottom navigation with all tabs', (WidgetTester tester) async {
    await tester.pumpWidget(const HealthMonitorApp());

    expect(find.text('Dashboard'), findsWidgets);
    expect(find.text('Sen'), findsWidgets);
    expect(find.text('Sport'), findsWidgets);
    expect(find.text('Analiza'), findsWidgets);
    expect(find.text('Ankieta'), findsWidgets);
    expect(find.text('Ustawienia'), findsWidgets);
  });
}
