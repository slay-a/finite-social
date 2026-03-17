import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Category } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

const ALL_CATEGORIES: Category[] = ['All', 'AI', 'Dev', 'Startups', 'Science', 'Repos'];

interface Props {
  active: Category;
  onChange: (c: Category) => void;
}

export default function CategoryBar({ active, onChange }: Props) {
  const theme = useTheme();
  const { disabledCategories } = useApp();
  const CATEGORIES = ALL_CATEGORIES.filter((c) => c === 'All' || !disabledCategories.has(c));
  return (
    <View style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat === active;
          const color = theme.categoryColors[cat];
          return (
            <TouchableOpacity
              key={cat}
              onPress={async () => {
                await Haptics.selectionAsync();
                onChange(cat);
              }}
              style={[
                s.pill,
                { borderColor: isActive ? color : theme.border },
                isActive && { backgroundColor: `${color}22` },
              ]}
              activeOpacity={0.7}
            >
              {isActive && <View style={[s.activeDot, { backgroundColor: color }]} />}
              <Text style={[s.pillText, { color: isActive ? color : theme.textMuted }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
