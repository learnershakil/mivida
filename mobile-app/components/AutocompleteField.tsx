/**
 * AutocompleteField — a live-filtered picker input that matches the task modal design.
 * Used for the Category picker (allowCreate) and the Contact picker (pick-existing-only). §4.5 / §4.7.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Suggestion, filterSuggestions, hasExactMatch } from '../services/autocomplete';

interface Props {
  icon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  suggestions: Suggestion[];
  onSelect: (s: Suggestion) => void;
  /** When true, offers "Create <value>" if the typed value has no exact match. */
  allowCreate?: boolean;
}

export function AutocompleteField({
  icon,
  placeholder,
  value,
  onChangeText,
  suggestions,
  onSelect,
  allowCreate = false,
}: Props) {
  const [focused, setFocused] = useState(false);

  const filtered = filterSuggestions(suggestions, value).slice(0, 6);
  const exact = hasExactMatch(suggestions, value);
  const showCreate = allowCreate && value.trim().length > 0 && !exact;
  const open = focused && (filtered.length > 0 || showCreate);

  return (
    <View>
      <View style={styles.inputRow}>
        {icon}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          // Delay so a tap on a suggestion registers before blur closes the list.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {open && (
        <View style={styles.dropdown}>
          {filtered.map((s) => (
            <TouchableOpacity
              key={s.id ?? s.label}
              style={styles.row}
              onPress={() => {
                onSelect(s);
                setFocused(false);
              }}
            >
              <Text style={styles.rowText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
          {showCreate && (
            <TouchableOpacity
              style={[styles.row, styles.createRow]}
              onPress={() => {
                onSelect({ label: value.trim() });
                setFocused(false);
              }}
            >
              <Plus size={16} color="#065F46" />
              <Text style={styles.createText}>Create “{value.trim()}”</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
  },
  input: { flex: 1, fontSize: 16 },
  dropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: { fontSize: 15, color: '#111827' },
  createRow: { backgroundColor: '#ECFDF5' },
  createText: { fontSize: 15, color: '#065F46', fontWeight: '600' },
});
