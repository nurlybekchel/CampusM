async function bootstrap() {
  const user = await App.getMe();
  App.mountTopbar({ active: "support", user });
}

bootstrap().catch(console.error);
