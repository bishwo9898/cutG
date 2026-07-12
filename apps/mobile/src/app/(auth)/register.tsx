import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, typography } from '@/theme';

const RegisterFormSchema = z
  .object({
    confirmPassword: z.string().min(12),
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(12),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof RegisterFormSchema>;

export default function RegisterScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const userType = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const { control, formState, handleSubmit, setError } = useForm<RegisterForm>({
    defaultValues: { confirmPassword: '', email: '', firstName: '', lastName: '', password: '' },
    resolver: zodResolver(RegisterFormSchema),
  });

  const onSubmit = async (values: RegisterForm): Promise<void> => {
    try {
      await mobileApi.auth.register({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
        userType,
      });
      router.push(
        '/(auth)/verify-email?email=' + encodeURIComponent(values.email) + '&role=' + userType,
      );
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Create account"
        subtitle={userType === 'BARBER' ? 'Barber workspace' : 'Client booking'}
      />
      {(['firstName', 'lastName', 'email', 'password', 'confirmPassword'] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field, fieldState }) => (
            <Input
              autoCapitalize={name === 'email' ? 'none' : 'words'}
              keyboardType={name === 'email' ? 'email-address' : 'default'}
              label={
                name === 'confirmPassword' ? 'Confirm password' : name.replace(/([A-Z])/g, ' $1')
              }
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              secureTextEntry={name.includes('password') || name.includes('Password')}
              value={field.value}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
      {formState.errors.root?.message !== undefined ? (
        <Text style={styles.error}>{formState.errors.root.message}</Text>
      ) : null}
      <Button
        disabled={formState.isSubmitting}
        title="Create Account"
        onPress={handleSubmit(onSubmit)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
});
