import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, User } from './api';
import { colors, fonts } from './theme';

type Mode = 'login' | 'register';

export function AuthScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(name, email, password);
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email && password && (mode === 'login' || name) && !busy;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🎬</Text>
        <Text style={styles.title}>Başrol</Text>
        <Text style={styles.subtitle}>
          Fotoğrafını yükle, sahneni seç; dizilerin başrolünde sen ol.
        </Text>

        {mode === 'register' && (
          <Text style={styles.gift}>🎁 Kayıt ol, ilk 3 videon ücretsiz!</Text>
        )}

        <View style={styles.tabs}>
          {(
            [
              ['register', 'Kayıt Ol'],
              ['login', 'Giriş Yap'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tab, mode === key && styles.tabActive]}
              onPress={() => {
                setMode(key);
                setError(null);
              }}
            >
              <Text style={[styles.tabText, mode === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Adın"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          placeholder={mode === 'register' ? 'Şifre (en az 6 karakter)' : 'Şifre'}
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          textContentType={mode === 'register' ? 'newPassword' : 'password'}
          onSubmitEditing={() => canSubmit && submit()}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, !canSubmit && styles.disabled]}
          disabled={!canSubmit}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 12, paddingVertical: 24 },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { color: colors.accent, fontFamily: fonts.display, fontSize: 44, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center', marginBottom: 8 },
  gift: {
    color: colors.bg,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    textAlign: 'center',
    fontWeight: '700',
    overflow: 'hidden',
  },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.border },
  tabText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: { color: colors.danger, fontSize: 14 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: colors.bg, fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
