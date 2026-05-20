import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,15}$/, { message: 'phone must contain 7–15 digits only' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
