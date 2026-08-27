import { useSignUp } from '@clerk/clerk-expo';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { clerkErrorMessage } from '@/lib/clerkErrorMessage';
import { colors, typography } from '@/theme';

const RegisterFormSchema = z
  .object({
    confirmPassword: z.string().min(12, 'Please confirm your 12-character password.'),
    email: z.string().email('Enter a valid email address.'),
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    password: z.string().min(12, 'Password must contain at least 12 characters.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof RegisterFormSchema>;

const fieldLabels: Record<keyof RegisterForm, string> = {
  confirmPassword: 'Confirm password',
  email: 'Email',
  firstName: 'First name',
  lastName: 'Last name',
  password: 'Password',
};

export default function RegisterScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const userType = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const { isLoaded, signUp } = useSignUp();
  const { control, formState, handleSubmit, setError } = useForm<RegisterForm>({
    defaultValues: { confirmPassword: '', email: '', firstName: '', lastName: '', password: '' },
    resolver: zodResolver(RegisterFormSchema),
  });

  const onSubmit = async (values: RegisterForm): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    try {
      await signUp.create({
        emailAddress: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      router.push(
        '/(auth)/verify-email?email=' + encodeURIComponent(values.email) + '&role=' + userType,
      );
    } catch (error) {
      setError('root', {
        message: clerkErrorMessage(error, 'We could not create your account.'),
      });
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Create account"
        subtitle={userType === 'BARBER' ? 'Barber workspace' : 'Customer booking'}
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
              label={fieldLabels[name]}
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
        title="Create account"
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
