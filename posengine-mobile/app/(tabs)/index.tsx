import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    // Simula login - aquí irían tus llamadas reales
    setTimeout(() => {
      setIsLoading(false);
      // setError('Credenciales incorrectas'); // Para probar errores
    }, 2000);
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>

      <ThemedView style={styles.container}>
        <ThemedView style={styles.card}>
          {/* Header */}
          <ThemedView style={styles.cardHeader}>
            <ThemedText type="title" style={styles.title}>Iniciar sesión</ThemedText>
            <ThemedText style={styles.description}>
              Ingresa tus credenciales para acceder a tu cuenta
            </ThemedText>
          </ThemedView>

          {/* Form */}
          <ThemedView style={styles.cardContent}>
            {error ? (
              <ThemedView style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            ) : null}

            {/* Email Input */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </ThemedView>

            {/* Password Input */}
            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.label}>Contraseña</ThemedText>
              <ThemedView style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <ThemedText style={styles.eyeIcon}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>

            {/* Forgot Password */}
            <ThemedView style={styles.forgotContainer}>
              {/* <Link href="/forgot-password" asChild>
    <TouchableOpacity>
      <ThemedText style={styles.linkText}>
        ¿Olvidaste tu contraseña?
      </ThemedText>
    </TouchableOpacity>
  </Link> */}
              <TouchableOpacity>
                <ThemedText style={styles.linkText}>
                  ¿Olvidaste tu contraseña?
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* ... */}

            <ThemedView style={styles.registerContainer}>
              <ThemedText style={styles.registerText}>¿No tienes una cuenta? </ThemedText>
              {/* <Link href="/register" asChild>
    <TouchableOpacity>
      <ThemedText style={styles.linkText}>Regístrate</ThemedText>
    </TouchableOpacity>
  </Link> */}
              <TouchableOpacity>
                <ThemedText style={styles.linkText}>Regístrate</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardHeader: {
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardContent: {
    padding: 24,
    paddingTop: 16,
    gap: 16,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 40,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  forgotContainer: {
    alignItems: 'flex-end',
  },
  linkText: {
    fontSize: 14,
    color: '#2563eb',
  },
  cardFooter: {
    padding: 24,
    paddingTop: 0,
    gap: 16,
  },
  submitButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
});