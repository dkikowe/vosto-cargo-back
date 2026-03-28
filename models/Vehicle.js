import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    plateNumber: { 
      type: String, 
      unique: true, 
      required: true,
      trim: true,
      uppercase: true
    },
    brand: { type: String, required: true }, // Volvo, Kamaz, etc.
    model: { type: String },
    
    type: { 
      type: String, 
      enum: ['TRUCK_5T', 'TRUCK_10T', 'TRUCK_20T', 'REF', 'VAN', 'FLATBED', 'SPECIAL'], 
      required: true 
    },
    
    capacity: {
      weight: { type: Number, required: true }, // кг
      volume: { type: Number },  // м3
      pallets: { type: Number }  // кол-во паллет
    },

    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },

    features: {
      hasLift: { type: Boolean, default: false },
      hasRef: { type: Boolean, default: false }, // Рефрижератор
      isAdr: { type: Boolean, default: false }   // Опасные грузы
    },

    status: {
      type: String,
      enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DECOMMISSIONED'],
      default: 'AVAILABLE'
    },

    // Кто сейчас за рулем
    currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Владелец автопарка (Логист/Компания)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Документы (СТС, Страховка и т.д.)
    documents: [{
      type: { type: String },
      number: String,
      expiryDate: Date,
      fileUrl: String
    }]
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);
