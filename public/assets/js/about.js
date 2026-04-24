async function bootstrap() {
  const user = await App.getMe();
  App.mountTopbar({ active: "about", user });
}

bootstrap().catch(console.error);
